# Miami Zip Recommender – PRD

18 Nov 2026 · @joana @Nadia

A web app where Miami house-hunters set preferences on a map or describe them in chat, and an MCP agent returns the top 5 zip codes with clear reasons for each.

Product aesthetics should attempt to match as best as the color scheme, fonts, and the style of https://flow.life/.

## Overview

**Problem.** People moving to Miami can't easily compare zip codes on budget, pets, vibe and other factors at once. Listing sites show homes, not which neighborhoods fit a household.

**Users.** Renters and buyers moving to or within Miami, including students and young families. For the final demo, the audience is the instructor and classmates.

**Product.** One website with two tabs in the top navigation:

- **Map:** structured filters → Apply → top 5 zips plotted on the map → click a zip to see its data and why it fits.
- **Chatbot:** the user types preferences in plain English → the MCP agent extracts filters, scores the zips and replies with the top 5 and its reasons.

Both tabs use the same MCP agent and scoring engine, so the same preferences give the same ranking.

### Goals for the demo

| Goal | Metric | Target |
|---|---|---|
| Fast results | Time from Apply to zips on the map | Under 5 s |
| Explainable picks | Top-5 zips that show a reason and their data values | 5 of 5 |
| Consistent engine | Same preferences via Map and Chatbot give the same top 5 | Same order |
| Reliable demo | Preset scenarios that run end to end on the live URL | 3 of 3 |
| Robust chat | Test prompts parsed into correct filters | 8 of 10 |

## User flows

The Map flow is the main demo; the Chatbot flow shows the same engine driven by natural language.

### Onboarding

**Flow 1:** Go through quick survey asking for user preferences that are relevant to the parameters the machine learning model uses to recommend the top sites. Questions include things like:

- How many people are going to live here?
- Do you have pets? Dogs?
- Do you prefer a quiet or busy area (what is the vibe you are looking for)
- What is your budget? (give ranges for the user to choose from)
- What housing type
- How many bedrooms and bathrooms would be preferable?

The onboarding survey should be simplistic and takes up the whole screen, with preferable buttons to x-choose-1 from (such as having apartment, house, walk-ups if applicable for miami to be large rectangles/squares that the user can press), or for budget and vibes provide a categorical slider that the user can slide between the extremes. This UI should be easy to navigate and quick to complete. Accompany warm and light simplistic graphics for the categories or the types.

These information can be skipped and filled in in more detail later by the user too.

Provide also a button to switch to chatbot, where the user can continue from where they left off in the survey (with details like people living together: x, however many as the user filled in).

**Flow 2:** The user types in their requests or wants in natural language, call a LLM to parse it in ways that fit the existing metrics we have. It is okay to leave it blank.

### Flow 1: Map (default landing page)

1. User opens the site and lands on the Map tab. The map of Miami is visible but has no plotted zips yet. The filter panel sits on the left.
2. User sets filters: budget, housing type and bedrooms, pet-friendly, vibe (quiet ↔ lively), and extra data-driven features (see Filters section).
3. User clicks Apply.
4. Frontend sends the filters to /api/recommend, which calls the MCP agent's score_zips tool.
5. The scoring engine filters, scores and ranks every Miami zip and returns the top 5 with scores, data values and reasons.
6. Map plots the top 5: each zip polygon is shaded by score with a rank badge (1–5), the map zooms to fit, and a ranked list appears in the panel.
7. User zooms or pans into any highlighted zip and clicks it (or clicks its card in the list).
8. A Zip Detail panel opens showing: rank and score, the zip's actual data values for each feature, a match indicator per feature against the user's filters, a score breakdown, and a 2–3 sentence reason for why it was picked and how it fits the user.
9. User can adjust filters and click Apply again; the map re-plots.

### Flow 2: Chatbot

1. User clicks Chatbot in the top navigation.
2. Chat page shows a welcome message and 3 clickable example prompts (e.g. "Quiet area under $2,000 that allows dogs").
3. User types a prompt and sends it.
4. Frontend sends the conversation to /api/chat. The LLM reads the prompt, extracts preferences and calls MCP tools (score_zips, then get_zip_details if needed).
5. The agent replies with the top 5 zips as cards: rank, zip and neighborhood, score, key data values and a reason for each.
6. The reply states which filters it understood (e.g. "Budget ≤ $2,000 · Pet-friendly · Quiet") so the user can correct it.
7. User can follow up ("What about something livelier?") and the agent re-scores with updated preferences.
8. Each zip card has a View on map button that switches to the Map tab with those filters applied and that zip selected.

## Functional requirements

Requirements are numbered so you can reference them in commits and test notes; P0 must ship for the demo, P1 ships if time allows.

| ID | Area | Requirement | Priority |
|---|---|---|---|
| NAV-1 | Navigation | Top bar with project name and two tabs: Map (default) and Chatbot; the active tab is highlighted | P0 |
| NAV-2 | Navigation | Opening the site goes straight to the Map tab; no login needed for the demo | P0 |
| MAP-1 | Map page | Full-height Miami map (center 25.76, -80.19, zoom 11) with all zip boundaries drawn in light gray and nothing plotted on load | P0 |
| MAP-2 | Map page | Left filter panel with every filter in the Filters section, each with a sensible default | P0 |
| MAP-3 | Map page | Apply button sends filters to the API; it is disabled and shows a spinner while loading | P0 |
| MAP-4 | Map page | Top 5 zips shaded on a 5-step color scale by score, each with a numbered rank badge; map auto-zooms to fit them | P0 |
| MAP-5 | Map page | Ranked list of the 5 zips under the filters: rank, zip, neighborhood, score /100, median rent | P0 |
| MAP-6 | Map page | Users can zoom and pan freely; hovering a highlighted zip shows a tooltip (zip, neighborhood, score) | P0 |
| MAP-7 | Map page | Clicking a zip on the map or in the list selects it, outlines it and opens the Zip Detail panel | P0 |
| MAP-8 | Map page | Legend for the color scale; Reset button clears filters and the plot | P1 |
| MAP-9 | Map page | Empty result shows "No zips match — try a higher budget or fewer must-haves"; errors show a retry message | P0 |
| DET-1 | Zip Detail | Shows rank, score and neighborhood name | P0 |
| DET-2 | Zip Detail | Table of this zip's real data values for every scored feature (e.g. median rent $2,150, noise level Low, pet-friendly listings 64%) | P0 |
| DET-3 | Zip Detail | Each feature marked as matching, partly matching or not matching the user's filter | P0 |
| DET-4 | Zip Detail | Score breakdown bars showing how much each feature contributed | P1 |
| DET-5 | Zip Detail | A 2–3 sentence reason: why it was picked and how it fits this user's stated preferences | P0 |
| CHAT-1 | Chatbot | Message thread, input box, Send button; Enter sends | P0 |
| CHAT-2 | Chatbot | Three clickable example prompts on an empty chat | P0 |
| CHAT-3 | Chatbot | Agent replies with the filters it understood, then the top 5 zip cards with reasons | P0 |
| CHAT-4 | Chatbot | Follow-up messages refine the previous preferences instead of starting over | P1 |
| CHAT-5 | Chatbot | "View on map" on a zip card opens the Map tab with those filters applied and that zip selected | P1 |
| CHAT-6 | Chatbot | Typing indicator while waiting; friendly error if the agent fails | P0 |
| DEMO-1 | Demo support | Three preset scenario buttons on the Map page that fill filters and apply | P0 |

## Filters and data fields

The four core filters are fixed; the "extra features" rows are placeholders to replace with the real columns in your dataset in hour 0.

| Filter | UI control | Request field | Dataset column (confirm) | How it's used |
|---|---|---|---|---|
| Budget | Slider 1,000–6,000/mo, step $100 | budgetMax | median_rent | Hard filter: rent ≤ budget; closer under budget scores higher |
| Housing type | Select: Apartment / House / Condo / Any | housingType | pct_apartment, pct_house, … | Weighted: share of that housing type in the zip |
| Bedrooms | Select: Studio / 1 / 2 / 3+ | bedrooms | median_rent_{n}br | Picks which rent column the budget is checked against |
| Pet-friendly | Switch | petFriendly | pet_friendly_pct | Hard filter when on (e.g. ≥ 30%), then weighted |
| Vibe | 5-step slider: Very quiet → Very lively | vibe (1–5) | noise_level, nightlife_count | Score = closeness to the chosen level |
| Extra: safety | Importance slider 0–5 | weights.safety | crime_index (lower better) | Weighted |
| Extra: transit | Importance slider 0–5 | weights.transit | transit_score | Weighted |
| Extra: schools | Importance slider 0–5 | weights.schools | school_rating | Weighted |
| Extra: walkability / amenities | Importance slider 0–5 | weights.amenities | walk_score, grocery_count | Weighted |

### Scoring rule (shared by Map and Chatbot)

1. Apply hard filters (budget, pet-friendly if on).
2. Min-max normalize every scored column to 0–1 across all Miami zips; invert "lower is better" columns.
3. Final score = weighted average of feature scores × 100. Budget, housing and vibe get a fixed base weight; extra features use the user's importance sliders.
4. Sort, keep the top 5, and return each feature's raw value, normalized score and contribution for the Zip Detail panel.

## System architecture

The browser only talks to the two API routes; they act as the MCP client, so the Map and the Chatbot always hit the same tools and the same scoring engine.

> **Implementation note (UI/ folder):** the "API routes" are implemented as a thin Python FastAPI backend (`UI/api/index.py`, served at `/api/py/*`) deployed as a Vercel Python function. It is the MCP client. See `UI/README.md`.

## API and MCP tool contracts

The browser never talks to the MCP server directly: two API routes act as the MCP client, so keys stay server-side and both tabs share one engine.

### MCP tools (exposed by your MCP server)

| Tool | Input | Output | Used by |
|---|---|---|---|
| score_zips | Preferences object (below) | Top-N ZipResult[] with scores, feature values and breakdown | Map Apply, Chatbot |
| get_zip_details | zip, Preferences | One ZipResult with all feature values and match flags | Zip Detail (any zip), Chatbot follow-ups |
| explain_fit | zip, Preferences, feature values | 2–3 sentence reason | Map reasons (batched for top 5) |

### POST /api/recommend (Map tab)

```json
{
  "budgetMax": 2200,
  "housingType": "apartment",
  "bedrooms": 1,
  "petFriendly": true,
  "vibe": 2,
  "weights": { "safety": 4, "transit": 3, "schools": 1, "amenities": 3 },
  "topN": 5
}
```

Response:

```json
{
  "results": [
    {
      "zip": "33133",
      "neighborhood": "Coconut Grove",
      "rank": 1,
      "score": 86.2,
      "centroid": [25.728, -80.242],
      "features": [
        { "key": "median_rent", "label": "Median rent (1BR)", "value": 2150, "unit": "$/mo", "match": "yes", "contribution": 21.5 },
        { "key": "noise_level", "label": "Noise level", "value": "Low", "match": "yes", "contribution": 17.0 },
        { "key": "pet_friendly_pct", "label": "Pet-friendly listings", "value": 64, "unit": "%", "match": "yes", "contribution": 14.2 }
      ],
      "reason": "Coconut Grove keeps you $50 under budget, is one of the quietest areas in your results, and 64% of listings allow pets."
    }
  ],
  "appliedFilters": { "budgetMax": 2200, "petFriendly": true, "vibe": 2 },
  "meta": { "zipsScored": 70, "matched": 18 }
}
```

`match: "yes" | "partial" | "no"` drives the check, half and cross icons in Zip Detail.

Errors: 400 `{ error }` for bad input, 200 with empty results when nothing matches, 500 `{ error }` otherwise.

### POST /api/chat (Chatbot tab)

Request: `{ "messages": [{ "role": "user", "content": "Quiet area under $2k, I have a dog" }] }`

The route sends the messages plus the MCP tool definitions to the LLM, runs the tool-call loop, and returns:

```json
{
  "reply": "Here are 5 quiet, dog-friendly zips under $2,000.",
  "understoodFilters": { "budgetMax": 2000, "petFriendly": true, "vibe": 1 },
  "results": ["…same ZipResult objects as /api/recommend…"]
}
```

Returning results in the same shape lets the chat cards and the "View on map" button reuse the Map components.

Shared types live in `lib/types.ts`: Preferences, ZipFeature, ZipResult, RecommendResponse, ChatResponse. Neither person changes them without telling the other.

## Non-functional requirements and acceptance criteria

### Non-functional requirements

- **Speed:** Map results in under 5 s; chat replies in under 10 s; first page load under 3 s.
- **Reliability:** If explain_fit or the LLM fails or takes over 4 s, the Map still shows results with a template reason. The map never shows a blank screen.
- **Consistency:** Map and Chatbot call the same score_zips tool, so the same preferences give the same ranking.
- **Security:** LLM and MCP keys live only in Vercel environment variables; nothing secret in the browser.
- **Devices:** Works in desktop Chrome; usable on a phone (panel stacks above the map).
- **Hosting:** Frontend and API routes on Vercel; MCP server on Render or Railway if it can't run as a Vercel function.

### Acceptance tests (run before code freeze)

- **AT-1:** On load, the map shows Miami zip boundaries with nothing highlighted.
- **AT-2:** Budget $2,000, pet-friendly on, quiet vibe → Apply → 5 zips shaded and ranked within 5 s, every zip at or under $2,000.
- **AT-3:** Zoom into the #3 zip and click it → Zip Detail shows its real data values, match icons and a reason that mentions the user's preferences.
- **AT-4:** Budget $800 → Apply → friendly "No zips match" message.
- **AT-5:** Stop the MCP server → Apply → error message with Retry, no crash.
- **AT-6:** Chatbot prompt "quiet place under 2k that allows dogs" → understood filters shown as budget ≤ $2,000, pet-friendly, quiet, plus 5 zip cards with reasons.
- **AT-7:** Same preferences in Map and Chatbot → identical top 5 in the same order.
- **AT-8:** Chat follow-up "make it livelier" → new results with a higher vibe value.
- **AT-9:** "View on map" from a chat card opens the Map tab with filters applied and that zip selected.
- **AT-10:** All three preset buttons work on the production URL.

## Work split

Person A owns the Map experience; Person B owns the engine (MCP tools, scoring, APIs) and the Chatbot experience. Each carries about 23 focused hours.

| Person A: Map experience | Hrs | Person B: Engine + Chatbot | Hrs |
|---|---|---|---|
| A1. Project setup, top nav with Map / Chatbot tabs, page layout | 2 | B1. Clean dataset into zips.json; simplified Miami ZCTA GeoJSON; mock response | 3 |
| A2. Filter panel: all controls, defaults, Apply, Reset | 4 | B2. MCP tools score_zips + get_zip_details with the shared scoring rule | 6 |
| A3. Map: tiles, gray zip boundaries, shading + rank badges, zoom-to-fit, hover tooltips | 5 | B3. explain_fit tool + 4 s timeout + template fallback | 2 |
| A4. Ranked list with map ↔ list selection sync | 3 | B4. /api/recommend route as MCP client, validation, errors | 2 |
| A5. Zip Detail panel: feature values table, match icons, breakdown bars, reason | 4 | B5. /api/chat: LLM + MCP tool loop, filter extraction, understoodFilters | 4 |
| A6. Loading / empty / error states, preset buttons, legend, mobile layout | 3 | B6. Chat UI: thread, input, example prompts, zip cards (reusing A's card style), "View on map" | 4 |
| A7. Acceptance tests AT-1 to AT-5, AT-10; bug fixes | 2 | B7. Vercel + MCP hosting, env vars, cached preset JSON; tests AT-6 to AT-9 | 2 |
| **Total** | **23** | **Total** | **23** |

### Person A detailed checklist

- Next.js + TypeScript + Tailwind + shadcn/ui; react-leaflet loaded with next/dynamic and ssr: false
- TopNav with Map and Chatbot links; Map is /, Chatbot is /chat
- FilterPanel holds one Preferences state object matching lib/types.ts; reads URL params so "View on map" can pre-fill it
- MapView: CARTO light tiles; GeoJSON for all zips in gray; after results, top 5 shaded on a green scale with rank badges and fitBounds
- Selecting a zip (map click, list click or ?zip= URL param) outlines it, pans to it and opens ZipDetailPanel
- ZipDetailPanel: header (rank, zip, neighborhood, score), features table with value, unit and check / half / cross icon, contribution bars, reason paragraph
- ZipCard component shared with Person B for chat results
- Works against public/mock/recommend.json until the live API is ready (NEXT_PUBLIC_USE_MOCK)

### Person B detailed checklist

- Confirm real dataset columns and update the Filters table in hour 0
- MCP server (your existing one) exposes score_zips, get_zip_details, explain_fit with JSON-schema inputs
- Scoring: hard filters → min-max normalize → invert lower-is-better → weighted sum × 100 → top 5 with per-feature value, match, contribution
- Sanity-check three scenarios against local knowledge of Miami
- lib/mcpClient.ts: one helper both API routes use to call MCP tools
- /api/chat system prompt: always call score_zips before recommending; never invent zip data; list understood filters first
- Chat page /chat reuses ZipCard; "View on map" links to /?{filters}&zip={zip}
- Save live responses for 3 presets to public/mock/presets/ as the demo fallback

Shared: agree lib/types.ts in hour 0, merge at every checkpoint, and rehearse the demo together.

## 48-hour timeline

Four sync checkpoints (S1–S4) keep the live URL working; code freezes at hour 44.

| Hours | Person A | Person B | Checkpoint |
|---|---|---|---|
| 0–2 | A1 setup, nav, layout | B1 starts: confirm columns, write mock, first Vercel deploy | S1: lib/types.ts agreed; empty map live on Vercel |
| 2–6 | A3 map with GeoJSON + mock results | B1 data + GeoJSON; B2 scoring starts | — |
| 6–10 | A2 filter panel | B2 MCP tools done; B4 /api/recommend | — |
| 10–12 | A4 ranked list + selection | B3 explain_fit + fallback | S2: Map flow on live data (Apply → top 5 plotted) |
| 12–20 | Sleep | Sleep | — |
| 20–26 | A5 Zip Detail panel | B5 /api/chat tool loop | — |
| 26–30 | A6 states, presets, legend, mobile | B6 Chat UI with ZipCard + "View on map" | S3: both tabs work end to end on production; bug list made |
| 30–32 | A7 tests + fixes | B7 hosting check, cached presets, tests | — |
| 32–40 | Sleep | Sleep | — |
| 40–44 | Fix remaining bugs; visual polish | Fix remaining bugs; prompt tuning for chat | S4: code freeze at hour 44 |
| 44–48 | Rehearse demo ×3 | Rehearse demo ×3 | Record a backup screen video |

## Demo script (about 4 minutes)

1. Open the site: empty Miami map. Explain the problem in one sentence.
2. Preset "Budget renter with a dog" → Apply → top 5 plotted.
3. Zoom into #1, click it, walk through its data values, match icons and reason.
4. Change the vibe to lively → Apply → show how the map shifts.
5. Switch to Chatbot, type the same preferences in plain English, show the same top 5 with reasons.
6. Click "View on map" to show both tabs share one engine.

## Out of scope, risks and open questions

**Out of scope for the demo:** user accounts and saved searches, individual property listings, areas outside Miami-Dade, live rent data refresh.

### Risks

| Risk | Owner | Mitigation |
|---|---|---|
| MCP server can't run on Vercel | B | Host it on Render/Railway; API routes call it over HTTP |
| Chatbot misreads preferences | B | Show understoodFilters in every reply; tune the system prompt with 10 test prompts |
| Map and Chat give different rankings | B | Both call score_zips; acceptance test AT-7 |
| Leaflet crashes on server render | A | next/dynamic with ssr: false from day 1 |
| Zip codes don't join to GeoJSON | Both | Zips as 5-character strings everywhere; test at S2 |
| LLM slow during the live demo | B | 4 s timeout + template reasons; cached preset results; backup video |

**Cut order if behind:** chat follow-ups (CHAT-4) → "View on map" (CHAT-5) → breakdown bars (DET-4) → mobile layout → LLM reasons on the Map (use templates). **Never cut:** Apply → top 5 on the map, Zip Detail with data and reason, a basic working chatbot.

### Open questions (answer in hour 0)

- Which columns does the dataset actually have for the "extra features"?
- Is the MCP server Python or Node, and where does it run today?
- Which LLM and API key does the chatbot use?
- Does "log into the system" mean a real login, or just opening the site? This PRD assumes no login.
