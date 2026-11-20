"""Chat -> Preferences extraction.

The chat route never ranks anything itself: it turns the conversation into the same Preferences
object the Map sends, then calls the same MCP score_zips tool, so Map and Chat give identical
rankings for identical preferences (PRD AT-7).

Extraction uses Gemini when GEMINI_API_KEY is set, otherwise (or on failure / timeout) a small
rule-based parser that covers the demo phrasings (AT-6, AT-8).
"""

import asyncio
import json
import os
import re
from typing import Any

from pydantic import ValidationError

from .models import ChatMessage, Preferences

LLM_TIMEOUT_S = 6.0

# --- rule-based parser ---------------------------------------------------------------------

_RELATIVE_LIVELIER = re.compile(r"\b(livelier|more lively|busier|more (?:fun|social|nightlife|action)|less quiet)\b")
_RELATIVE_QUIETER = re.compile(r"\b(quieter|calmer|more quiet|more peaceful|less (?:lively|busy|noisy))\b")
_VIBES = [
    (1, re.compile(r"\b(very quiet|super quiet|really quiet|peaceful|secluded)\b")),
    (5, re.compile(r"\b(very lively|super lively|party|buzzing|vibrant nightlife)\b")),
    (2, re.compile(r"\b(quiet|calm|relaxed|low[- ]key|chill)\b")),
    (4, re.compile(r"\b(lively|vibrant|nightlife|social|busy|energetic|fun)\b")),
    (3, re.compile(r"\b(balanced|mix of|in between|moderate)\b")),
]
_BUDGET_PATTERNS = [
    re.compile(r"\$\s?(\d+(?:\.\d+)?)\s?k\b"),
    re.compile(r"\b(\d+(?:\.\d+)?)\s?k\b"),
    re.compile(r"\$\s?(\d{1,2},\d{3}|\d{3,5})\b"),
    re.compile(r"\b(?:under|below|less than|max(?:imum)?|up to|budget(?: is| of)?|around|about)\s+(\d{1,2},\d{3}|\d{3,5})\b"),
]


def _parse_budget(text: str) -> float | None:
    for index, pattern in enumerate(_BUDGET_PATTERNS):
        match = pattern.search(text)
        if not match:
            continue
        value = float(match.group(1).replace(",", ""))
        if index < 2:
            value *= 1000
        if 300 <= value <= 20000:
            return value
    return None


def apply_rules(prefs: dict[str, Any], text: str) -> dict[str, Any]:
    """Update a preferences dict from one user message."""
    t = text.lower()
    out = json.loads(json.dumps(prefs))
    weights = out.setdefault("weights", {})

    budget = _parse_budget(t)
    if budget is not None:
        out["budgetMax"] = budget

    if re.search(r"\b(no pets?|don'?t have (?:a |any )?pets?|without pets?)\b", t):
        out["petFriendly"] = False
    elif re.search(r"\b(dogs?|puppy|puppies|cats?|kitten|pets?|pet[- ]friendly)\b", t):
        out["petFriendly"] = True

    if _RELATIVE_LIVELIER.search(t):
        out["vibe"] = min(5, int(out.get("vibe", 3)) + 1)
    elif _RELATIVE_QUIETER.search(t):
        out["vibe"] = max(1, int(out.get("vibe", 3)) - 1)
    else:
        for level, pattern in _VIBES:
            if pattern.search(t):
                out["vibe"] = level
                break

    if re.search(r"\bstudio\b", t):
        out["bedrooms"] = 0
    else:
        beds = re.search(r"\b(\d)\s?(?:-\s?)?(?:bed(?:room)?s?|br|bd)\b", t)
        if beds:
            out["bedrooms"] = min(3, int(beds.group(1)))

    if re.search(r"\b(apartment|apt|flat)s?\b", t):
        out["housingType"] = "apartment"
    elif re.search(r"\bcondos?\b", t):
        out["housingType"] = "condo"
    elif re.search(r"\b(house|single[- ]family|townhouse)s?\b", t):
        out["housingType"] = "house"

    people = re.search(r"\b(\d+)\s+(?:people|persons|of us|adults|roommates)\b", t) or re.search(
        r"\b(?:family|household|group) of (\d+)\b", t
    )
    if people:
        out["householdSize"] = max(1, min(10, int(people.group(1))))
    elif re.search(r"\b(my partner|my wife|my husband|my girlfriend|my boyfriend|couple)\b", t):
        out["householdSize"] = 2

    if re.search(r"\b(transit|metro(?:rail|mover)?|bus(?:es)?|commute|no car|public transport)\b", t):
        weights["transit"] = 5
    if re.search(r"\b(walkable|walk(?:ing)? distance|walk everywhere|amenities|groceries)\b", t):
        weights["amenities"] = 5
    if re.search(r"\b(safe|safety|secure)\b", t):
        weights["safety"] = 5
    if re.search(r"\b(schools?|kids|children|family)\b", t):
        weights["schools"] = 5
    return out


def rule_based_preferences(messages: list[ChatMessage], base: dict[str, Any]) -> dict[str, Any]:
    prefs = base
    for message in messages:
        if message.role == "user":
            prefs = apply_rules(prefs, message.content)
    return prefs


# --- LLM extraction (Gemini) ---------------------------------------------------------------

SYSTEM_PROMPT = """You convert a Miami house-hunter's conversation into search filters.
Return ONLY a JSON object with these keys (keep the current value when the user did not change it):
  budgetMax (number, monthly USD), housingType ("apartment"|"house"|"condo"|"any"),
  bedrooms (0 = studio, 1, 2, 3 = 3+), petFriendly (boolean), vibe (1 very quiet .. 5 very lively),
  weights {safety, transit, schools, amenities} each 0-5, householdSize (int or null).
Later messages refine earlier ones: "make it livelier" means vibe + 1, "cheaper" lowers budgetMax.
Never invent zip codes or data. Do not add other keys."""


async def llm_preferences(messages: list[ChatMessage], base: dict[str, Any]) -> dict[str, Any] | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        transcript = "\n".join(f"{m.role}: {m.content}" for m in messages)
        prompt = f"Current filters: {json.dumps(base)}\n\nConversation:\n{transcript}"
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0,
                ),
            ),
            timeout=LLM_TIMEOUT_S,
        )
        data = json.loads(response.text or "{}")
        merged = {**base, **{k: v for k, v in data.items() if v is not None}}
        return Preferences.model_validate(merged).model_dump(exclude_none=True)
    except (Exception, asyncio.TimeoutError):  # any LLM problem -> rule-based fallback
        return None


async def extract_preferences(
    messages: list[ChatMessage], context: dict[str, Any] | None
) -> tuple[Preferences, str]:
    """Returns (preferences, parser_used)."""
    base = Preferences().model_dump(exclude_none=True)
    if context:
        try:
            base = Preferences.model_validate({**base, **context}).model_dump(exclude_none=True)
        except ValidationError:
            pass  # ignore a bad context rather than failing the chat
    llm = await llm_preferences(messages, base)
    if llm is not None:
        return Preferences.model_validate(llm), "llm"
    rules = rule_based_preferences(messages, base)
    try:
        return Preferences.model_validate(rules), "rules"
    except ValidationError:
        return Preferences.model_validate(base), "rules"


def summarize(prefs: Preferences, count: int) -> str:
    vibe = {1: "very quiet", 2: "quiet", 3: "", 4: "lively", 5: "very lively"}[prefs.vibe]
    words = [w for w in (vibe, "pet-friendly" if prefs.petFriendly else "") if w]
    if count == 0:
        return "No zips match — try a higher budget or fewer must-haves."
    described = ", ".join(words) + " " if words else ""
    return f"Here are {count} {described}zips under ${prefs.budgetMax:,.0f}."
