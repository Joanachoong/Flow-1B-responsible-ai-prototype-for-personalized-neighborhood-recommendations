"""Translate between the UI's contract (lib/types.ts) and the MCP server's tools in src/.

Field renaming and unit conversion only. NO ranking, filtering or scoring happens here: the order,
scores, rents and contributions all come unchanged from the engine's `recommend` and
`area_stats` tools.
"""

from typing import Any

from .models import Meta, Preferences, ZipFeature, ZipResult

MAX_K = 5  # the engine returns at most 5 ZIPs

TAG_LABELS = {
    "transit": "Transit",
    "walkable": "Walkability",
    "social": "Social / nightlife",
    "quiet": "Quiet",
    "low_noise": "Low noise",
    "pet_friendly": "Pet-friendly",
    "co_living": "Co-living friendly",
    "near": "Near your places",
}


def _priority(weight: int) -> int | None:
    """UI slider 0-5 -> engine priority 1-3 (0 = not asked for)."""
    if weight <= 0:
        return None
    return 1 if weight <= 2 else 2 if weight <= 4 else 3


def to_recommend_args(prefs: Preferences) -> dict[str, Any]:
    """UI Preferences -> arguments of the engine's `recommend` tool.

    The engine has no data for safety, schools, housing type or bedrooms, so those UI settings
    are not sent.
    """
    weights: dict[str, int] = {}
    for tag, weight in (("transit", prefs.weights.transit), ("walkable", prefs.weights.amenities)):
        priority = _priority(weight)
        if priority:
            weights[tag] = priority
    if prefs.vibe <= 2:
        weights["quiet"] = 3 if prefs.vibe == 1 else 2
    elif prefs.vibe >= 4:
        weights["social"] = 3 if prefs.vibe == 5 else 2
    if prefs.petFriendly:
        weights["pet_friendly"] = 2
    return {
        "budget_max": prefs.budgetMax,
        "household": "with_co_leaser" if (prefs.householdSize or 1) >= 2 else "alone",
        "housing_preference": "own_apartment",
        "tags": list(weights),
        "weights": weights,
        "k": min(prefs.topN, MAX_K),
    }


def _match(value: float | None) -> str:
    """Display icon only (✓ / ~ / ✗) for a 0-1 engine value."""
    if value is None:
        return "partial"
    return "yes" if value >= 0.67 else "partial" if value >= 0.34 else "no"


def _percent(value: float | None) -> float | None:
    return None if value is None else round(value * 100, 1)


def from_recommend_item(item: dict[str, Any]) -> ZipResult:
    """One entry of recommend.results -> ZipResult."""
    features = [
        ZipFeature(
            key="median_rent",
            label="Rent benchmark (HUD 1BR)",
            value=item.get("rent_usd"),
            unit="$/mo",
            match="yes",  # the engine only returns in-budget ZIPs
            contribution=0.0,
        )
    ]
    for pref in item.get("matched_preferences", []):
        tag = pref.get("tag", "")
        features.append(
            ZipFeature(
                key=tag,
                label=TAG_LABELS.get(tag, tag.replace("_", " ").capitalize()),
                value=_percent(pref.get("feature_value")),
                unit="%",
                match=_match(pref.get("feature_value")),
                contribution=_percent(pref.get("contribution")) or 0.0,
            )
        )
    transit = item.get("transit_service") or {}
    if transit.get("transit_stops") is not None:
        features.append(
            ZipFeature(key="transit_stops", label="Transit stops", value=int(transit["transit_stops"]),
                       unit="stops", match="partial", contribution=0.0)
        )
    return ZipResult(
        zip=item["zip"],
        neighborhood=item.get("neighborhood") or item.get("area_name") or "",
        rank=item.get("rank", 0),
        score=_percent(item.get("score")) or 0.0,
        features=features,
    )


def from_recommendation(payload: Any) -> tuple[list[ZipResult], Meta]:
    """The `recommend` tool's whole response -> (results, meta), in the engine's order."""
    if not isinstance(payload, dict):
        raise ValueError("Recommendation engine returned an unexpected response.")
    results = [from_recommend_item(item) for item in payload.get("results", [])]
    eligible = int(payload.get("eligible_count", len(results)))
    excluded = sum(int(v) for v in (payload.get("excluded_counts") or {}).values())
    return results, Meta(zipsScored=eligible + excluded, matched=eligible)


def from_area_stats(payload: dict[str, Any]) -> ZipResult:
    """`area_stats` for one ZIP (not in the user's top results) -> ZipResult with rank 0."""
    stats = payload.get("public_stats") or {}
    features = [
        ZipFeature(key="median_rent", label="Median rent (Census)", value=stats.get("median_rent_usd"),
                   unit="$/mo", match="partial"),
        ZipFeature(key="population", label="Population", value=stats.get("population"), match="partial"),
    ]
    constant = set(payload.get("constant_scores") or [])
    for tag, value in (payload.get("lifestyle_scores") or {}).items():
        if tag in constant:
            continue  # identical in every ZIP, so it says nothing about this one
        features.append(
            ZipFeature(key=tag, label=TAG_LABELS.get(tag, tag.replace("_", " ").capitalize()),
                       value=_percent(value), unit="%", match=_match(value))
        )
    return ZipResult(zip=payload["zip"], neighborhood=payload.get("area_name") or "", rank=0, score=0.0,
                     features=features)
