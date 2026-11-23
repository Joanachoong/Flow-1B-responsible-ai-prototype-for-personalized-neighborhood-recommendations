# Miami Zip Finder (UI)

The web app from [PRD.md](PRD.md). Miami house-hunters set preferences on a map or describe them in chat, and the MCP engine returns the top 5 zip codes, each with the reason it was picked.

```
Browser (Next.js: Map tab, Chatbot tab, Leaflet map)
   │  /api/py/recommend · /api/py/chat · /api/py/zip-details · /api/py/health
   ▼
Python backend: api/index.py (FastAPI, deployed as a Vercel Python function)
   │  validates input → mcp_client.call_tool(...)    (contains no scoring logic)
   ▼
MCP server: NOT BUILT YET. Its URL comes from the MCP_SERVER_URL environment variable.
   tools: score_zips · get_zip_details · explain_fit
```

- **Frontend (`app/`, `components/`, `lib/`)** holds all of the UI. It turns UI state into a `Preferences` object, calls the backend, and renders the results. It never ranks anything.
- **Backend (`api/`)** is a thin pass-through to the MCP tools. It validates input with pydantic, applies the 4-second `explain_fit` fallback to template reasons, and maps errors to 400, 503 or 500.
- **The map is drawn in the frontend.** ZIP boundaries are a static file, [public/geo/miami-zctas.geojson](public/geo/miami-zctas.geojson), so they show before any API call (MAP-1). The backend returns only data (zip, score, centroid, features, reason), and the map joins it to the polygons by zip.
- **Shared contract:** [lib/types.ts](lib/types.ts) mirrors [api/_lib/models.py](api/_lib/models.py). Change them together.

## Run locally

```bash
cd UI
npm install
cp .env.example .env.local          # NEXT_PUBLIC_USE_MOCK=true by default
npm run dev                         # http://localhost:3000
```

**Mock mode** (`NEXT_PUBLIC_USE_MOCK=true`) reads `public/mock/*.json`, so no backend is needed. The top bar shows a "Sample data" badge. The sample values are real Miami numbers from `data/cleaned/`, but the ranking is a stand-in (see [scripts/build_mock_fixtures.py](scripts/build_mock_fixtures.py)).

**Live mode** (`NEXT_PUBLIC_USE_MOCK=false`) also needs the Python backend:

```bash
cd UI
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
npm run dev:api                     # FastAPI on :8000. next dev proxies /api/py/* to it
npm run dev                         # in a second terminal
```

Until `MCP_SERVER_URL` is set, Apply shows "Recommendation engine not connected yet" with a Retry button (AT-5). This is the expected behaviour for now.

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | frontend (public) | `true` uses the sample JSON, `false` calls the backend |
| `NEXT_PUBLIC_MAP_TILE_URL` | frontend (public, optional) | Basemap tile URL. Defaults to OpenStreetMap, warm-greyed in CSS. CARTO basemaps now require an API key. |
| `MCP_SERVER_URL` | backend only | Streamable-HTTP URL of the MCP server. Leave it empty for now. |
| `MCP_API_KEY` | backend only | Optional bearer token for the MCP server |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | backend only | Optional. The chat uses Gemini to turn messages into filters; without a key, a rule-based parser is used. |

Never put secrets in `NEXT_PUBLIC_*` variables.

## Deploy to Vercel

1. In Vercel, go to the project's **Settings → Build & Deployment** and set **Root Directory** to `UI`. This fixes the earlier `PYTHON_ENTRYPOINT_NOT_FOUND` error, which happened because Vercel built the repo root.
2. The framework is detected as Next.js ([vercel.json](vercel.json) pins it). `api/index.py` is deployed automatically as a Python function from [requirements.txt](requirements.txt).
3. Add the environment variables above. For the first deploy, `NEXT_PUBLIC_USE_MOCK=true` gives a working demo URL straight away.
4. Point the project at the branch you want to deploy, or merge `joana` into `main`.

## Connecting the real MCP server later

[api/_lib/mcp_client.py](api/_lib/mcp_client.py) is the only file that talks to MCP. To connect a server:

1. Run an MCP server with the **Streamable HTTP** transport (on Render or Railway, per the PRD) that exposes these tools:
   - `score_zips(preferences)` returns `{results: ZipResult[], meta}` or a bare `ZipResult[]`
   - `get_zip_details(zip, preferences)` returns one `ZipResult`
   - `explain_fit(zip, preferences, features)` returns a 2–3 sentence string
2. Set `MCP_SERVER_URL` (and `MCP_API_KEY` if needed) in Vercel, and set `NEXT_PUBLIC_USE_MOCK=false`.

No backend code changes are needed if the tools follow the shapes in [PRD.md](PRD.md). The existing recommender in `src/flow_neighborhoods/` uses a different request shape (tags, k ≤ 5), so the MCP server will need a small adapter.

> **Data gap for whoever builds the engine:** the PRD's extra filters assume `crime_index`, `school_rating` and housing-type shares. None of these are in `data/cleaned/` yet. What exists: rent by bedroom count (`hud_*`, `zori_latest_rent`), `quiet`, `social`, `pet_friendly`, `walkable`, `transit` and transit stop counts.

## Tests

```bash
cd UI
pip install -r requirements.txt pytest httpx
pytest tests                 # backend: validation, 503 without MCP, a fake in-process MCP server, chat parser
npm run typecheck && npm run build
```

## Where each requirement lives

| Requirement | Code |
|---|---|
| NAV-1/2 | [components/TopNav.tsx](components/TopNav.tsx), [app/page.tsx](app/page.tsx) |
| Onboarding survey | [components/OnboardingSurvey.tsx](components/OnboardingSurvey.tsx) (shown on first visit, skippable, "Continue in chat") |
| MAP-1..9, DEMO-1 | [components/MapPage.tsx](components/MapPage.tsx), [MapView.tsx](components/MapView.tsx), [FilterPanel.tsx](components/FilterPanel.tsx), [PresetButtons.tsx](components/PresetButtons.tsx), [Legend.tsx](components/Legend.tsx), [states.tsx](components/states.tsx) |
| DET-1..5 | [components/ZipDetailPanel.tsx](components/ZipDetailPanel.tsx), [MatchIcon.tsx](components/MatchIcon.tsx), [ContributionBars.tsx](components/ContributionBars.tsx) |
| CHAT-1..6 | [components/ChatPage.tsx](components/ChatPage.tsx), [ZipCard.tsx](components/ZipCard.tsx) (shared with the Map) |
| Backend / MCP client | [api/index.py](api/index.py), [api/_lib/](api/_lib/) |

## Notes

- **Chat follow-ups (CHAT-4):** the backend is stateless. The browser sends the whole conversation plus any onboarding answers, and the backend re-derives the filters each turn. "Make it livelier" adds one to the vibe.
- **Map and Chat consistency (AT-7):** chat turns the conversation into the same `Preferences` object and calls the same `score_zips` tool as the Map.
- **Mock mode:** chat always returns the same sample answer, and the Map's sample ranking only applies the budget. Both behave properly once the MCP server is connected.
- **Score colours:** the 5-step map scale spans the score range of the current results, so the five zips are always visually distinct. The legend shows the actual ranges.
- **Map tiles:** OpenStreetMap's tile policy is meant for light use. For heavier traffic, set `NEXT_PUBLIC_MAP_TILE_URL` to a keyed provider.
- **Regenerating static assets:** `scripts/build_zcta_geojson.py` rebuilds the ZIP boundaries (Census 2020 ZCTAs, 80 polygons; five Miami-Dade ZIPs are PO-box-only and have no area). `scripts/build_mock_fixtures.py` rebuilds the sample JSON.
