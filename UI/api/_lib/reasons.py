"""Template reasons: the fallback when explain_fit fails or takes over 4 s (PRD reliability NFR).

Built only from values the engine returned — never invents data.
"""

from .models import Preferences, ZipResult

VIBE_WORDS = {1: "very quiet", 2: "quiet", 3: "balanced", 4: "lively", 5: "very lively"}


def _rent(result: ZipResult) -> float | None:
    for feature in result.features:
        if feature.key.startswith("median_rent") and isinstance(feature.value, (int, float)):
            return float(feature.value)
    return None


def template_reason(result: ZipResult, prefs: Preferences) -> str:
    name = result.neighborhood or result.zip
    parts: list[str] = []
    rent = _rent(result)
    if rent is not None and rent <= prefs.budgetMax:
        parts.append(f"keeps you about ${prefs.budgetMax - rent:,.0f} under your ${prefs.budgetMax:,.0f} budget")
    strong = [f.label.lower() for f in result.features if f.match == "yes" and not f.key.startswith("median_rent")]
    if strong:
        parts.append("matches your " + ", ".join(strong[:3]) + " preferences")
    weak = [f.label.lower() for f in result.features if f.match == "no"]
    first = f"{name} ranks #{result.rank} with a score of {result.score:.0f}/100"
    sentence = first + (" and " + " and ".join(parts) if parts else "") + "."
    if weak:
        sentence += f" It is weaker on {', '.join(weak[:2])}."
    else:
        sentence += f" It fits the {VIBE_WORDS.get(prefs.vibe, 'balanced')} vibe you asked for."
    return sentence
