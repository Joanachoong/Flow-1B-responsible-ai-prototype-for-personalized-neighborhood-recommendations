"""Backend tests. Run from UI/:  pip install -r requirements.txt httpx pytest && pytest tests

A fake in-process MCP server stands in for the real one, so these tests exercise the actual
MCP client path (protocol, tool names, payload shapes) without any network.
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from mcp.server.mcpserver import MCPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))

import index  # noqa: E402
from _lib import mcp_client  # noqa: E402
from _lib.chat_agent import apply_rules  # noqa: E402
from _lib.models import Preferences  # noqa: E402

AREAS = [
    {"zip": "33133", "area_name": "Coconut Grove", "rent": 2150, "quiet": 0.9},
    {"zip": "33145", "area_name": "Silver Bluff", "rent": 1850, "quiet": 0.7},
    {"zip": "33010", "area_name": "Hialeah", "rent": 1700, "quiet": 0.6},
]


def fake_server() -> MCPServer:
    """Same tool names and response shapes as src/flow_neighborhoods/mcp_server.py."""
    server = MCPServer("fake-engine")
    calls: list[dict] = []
    server.calls = calls  # type: ignore[attr-defined]

    @server.tool()
    def recommend(budget_max: float, household: str, housing_preference: str, tags: list[str],
                  k: int = 3, weights: dict | None = None, near: list[str] | None = None) -> dict:
        calls.append({"budget_max": budget_max, "household": household, "tags": tags, "weights": weights, "k": k})
        fits = [a for a in AREAS if a["rent"] <= budget_max][:k]
        return {
            "status": "ok" if fits else "no_matches",
            "results": [
                {
                    "zip": a["zip"],
                    "area_name": a["area_name"],
                    "neighborhood": a["area_name"],
                    "rank": i + 1,
                    "score": 0.9 - i * 0.05,
                    "rent_usd": a["rent"],
                    "matched_preferences": [
                        {"tag": "quiet", "priority": 2, "feature_value": a["quiet"], "contribution": 0.4}
                    ],
                    "transit_service": {"transit_stops": 40.0},
                }
                for i, a in enumerate(fits)
            ],
            "eligible_count": len([a for a in AREAS if a["rent"] <= budget_max]),
            "excluded_counts": {"over_budget": len([a for a in AREAS if a["rent"] > budget_max])},
        }

    @server.tool()
    def area_stats(zip_code: str = "") -> dict:
        area = next((a for a in AREAS if a["zip"] == zip_code), None)
        if area is None:
            return {"zip": zip_code, "status": "unknown_area"}
        return {
            "zip": zip_code,
            "status": "ok",
            "area_name": area["area_name"],
            "public_stats": {"median_rent_usd": area["rent"], "population": 1000.0},
            "lifestyle_scores": {"quiet": area["quiet"], "pet_friendly": 0.6},
            "constant_scores": ["pet_friendly"],
        }

    return server


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("MCP_SERVER_URL", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(mcp_client, "_server_override", None)
    return TestClient(index.app)


def test_health(client):
    body = client.get("/api/py/health").json()
    # The repo's src/ MCP server is found automatically, so the engine counts as configured.
    assert body == {"status": "ok", "mcpConfigured": True, "llmConfigured": False}


def test_recommend_without_mcp_is_503(client, monkeypatch):  # AT-5
    monkeypatch.setattr(mcp_client, "_local_server_available", lambda: False)
    response = client.post("/api/py/recommend", json={"budgetMax": 2000})
    assert response.status_code == 503
    assert "not connected" in response.json()["error"]


def test_bad_input_is_400(client):
    response = client.post("/api/py/recommend", json={"budgetMax": -5})
    assert response.status_code == 400
    assert "budgetMax" in response.json()["error"]
    assert client.post("/api/py/recommend", json={"nope": 1}).status_code == 400


def test_recommend_through_mcp(client, monkeypatch):
    server = fake_server()
    monkeypatch.setattr(mcp_client, "_server_override", server)
    response = client.post("/api/py/recommend", json={"budgetMax": 2000, "petFriendly": True, "vibe": 2})
    assert response.status_code == 200
    body = response.json()
    assert [r["zip"] for r in body["results"]] == ["33145", "33010"]  # engine order, unchanged
    assert [r["rank"] for r in body["results"]] == [1, 2]
    assert [r["score"] for r in body["results"]] == [90.0, 85.0]  # engine 0-1 score shown as /100
    assert body["results"][0]["reason"].startswith("Silver Bluff ranks #1")
    assert body["appliedFilters"]["budgetMax"] == 2000
    assert body["meta"] == {"zipsScored": 3, "matched": 2}
    sent = server.calls[0]
    assert sent["budget_max"] == 2000 and sent["household"] == "alone" and sent["k"] == 5
    assert sent["weights"] == {"transit": 2, "walkable": 2, "quiet": 2, "pet_friendly": 2}


def test_empty_result_is_200(client, monkeypatch):  # AT-4
    monkeypatch.setattr(mcp_client, "_server_override", fake_server())
    response = client.post("/api/py/recommend", json={"budgetMax": 800})
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_chat_matches_map_ranking(client, monkeypatch):  # AT-6 / AT-7
    monkeypatch.setattr(mcp_client, "_server_override", fake_server())
    chat = client.post(
        "/api/py/chat", json={"messages": [{"role": "user", "content": "quiet place under 2k that allows dogs"}]}
    ).json()
    understood = chat["understoodFilters"]
    assert (understood["budgetMax"], understood["petFriendly"], understood["vibe"]) == (2000, True, 2)
    map_body = client.post("/api/py/recommend", json=understood).json()
    assert [r["zip"] for r in chat["results"]] == [r["zip"] for r in map_body["results"]]


def test_zip_details_in_top_results(client, monkeypatch):
    monkeypatch.setattr(mcp_client, "_server_override", fake_server())
    body = client.post("/api/py/zip-details", json={"zip": "33145", "preferences": {"budgetMax": 2000}}).json()
    assert body["zip"] == "33145" and body["rank"] == 1 and body["reason"]


def test_zip_details_outside_top_results_uses_area_stats(client, monkeypatch):
    monkeypatch.setattr(mcp_client, "_server_override", fake_server())
    body = client.post("/api/py/zip-details", json={"zip": "33133", "preferences": {"budgetMax": 2000}}).json()
    assert body["zip"] == "33133" and body["rank"] == 0 and body["neighborhood"] == "Coconut Grove"
    keys = [f["key"] for f in body["features"]]
    assert "quiet" in keys and "pet_friendly" not in keys  # constant scores are dropped


def test_zip_details_unknown_zip_is_404(client, monkeypatch):
    monkeypatch.setattr(mcp_client, "_server_override", fake_server())
    response = client.post("/api/py/zip-details", json={"zip": "99999", "preferences": {"budgetMax": 2000}})
    assert response.status_code == 404


def test_real_engine_from_src(client):
    """End to end against the real MCP server in ../src (skipped if its deps are missing)."""
    pytest.importorskip("jsonschema")
    response = client.post("/api/py/recommend", json={"budgetMax": 2500, "vibe": 4})
    assert response.status_code == 200, response.json()
    results = response.json()["results"]
    assert 1 <= len(results) <= 5 and [r["rank"] for r in results] == list(range(1, len(results) + 1))


@pytest.mark.parametrize(
    "text, expected",
    [
        ("quiet place under 2k that allows dogs", {"budgetMax": 2000.0, "petFriendly": True, "vibe": 2}),
        ("Quiet area under $2,000 that allows dogs", {"budgetMax": 2000.0, "petFriendly": True, "vibe": 2}),
        ("lively 2 bedroom apartment, budget 3500, near the metro", {"budgetMax": 3500.0, "vibe": 4, "bedrooms": 2, "housingType": "apartment"}),
        ("studio for $1.8k, very quiet please", {"budgetMax": 1800.0, "bedrooms": 0, "vibe": 1}),
        ("family of 4 with kids, want a safe house", {"housingType": "house", "householdSize": 4}),
    ],
)
def test_rule_parser(text, expected):
    prefs = apply_rules(Preferences().model_dump(exclude_none=True), text)
    for key, value in expected.items():
        assert prefs[key] == value, key


def test_follow_up_makes_it_livelier():  # AT-8
    base = apply_rules(Preferences().model_dump(exclude_none=True), "quiet place under 2k")
    after = apply_rules(base, "make it livelier")
    assert after["vibe"] == base["vibe"] + 1 and after["budgetMax"] == 2000
