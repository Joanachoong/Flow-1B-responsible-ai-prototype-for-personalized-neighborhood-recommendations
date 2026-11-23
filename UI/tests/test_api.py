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
    {"zip": "33133", "neighborhood": "Coconut Grove", "rent": 2150, "quiet": 0.9},
    {"zip": "33145", "neighborhood": "Silver Bluff", "rent": 1850, "quiet": 0.7},
    {"zip": 33010, "neighborhood": "Hialeah", "rent": 1700, "quiet": 0.6},
]


def fake_server(explain_ok: bool = True) -> MCPServer:
    server = MCPServer("fake-engine")

    @server.tool()
    def score_zips(preferences: dict) -> dict:
        budget = preferences["budgetMax"]
        fits = [a for a in AREAS if a["rent"] <= budget]
        return {
            "results": [
                {
                    "zip": a["zip"],
                    "neighborhood": a["neighborhood"],
                    "score": 90 - i * 5,
                    "centroid": [25.7, -80.2],
                    "features": [
                        {"key": "median_rent", "label": "Median rent", "value": a["rent"], "unit": "$/mo", "match": "yes", "contribution": 20},
                        {"key": "quiet", "label": "Quiet", "value": a["quiet"], "match": "yes", "contribution": 15},
                    ],
                }
                for i, a in enumerate(fits)
            ],
            "meta": {"zipsScored": len(AREAS), "matched": len(fits)},
        }

    @server.tool()
    def explain_fit(zip: str, preferences: dict, features: list) -> str:
        if not explain_ok:
            raise ValueError("LLM down")
        return f"{zip} fits you."

    @server.tool()
    def get_zip_details(zip: str, preferences: dict) -> dict:
        return {"zip": zip, "neighborhood": "Somewhere", "score": 50, "features": []}

    return server


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("MCP_SERVER_URL", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(mcp_client, "_server_override", None)
    return TestClient(index.app)


def test_health(client):
    body = client.get("/api/py/health").json()
    assert body == {"status": "ok", "mcpConfigured": False, "llmConfigured": False}


def test_recommend_without_mcp_is_503(client):  # AT-5
    response = client.post("/api/py/recommend", json={"budgetMax": 2000})
    assert response.status_code == 503
    assert "not connected" in response.json()["error"]


def test_bad_input_is_400(client):
    response = client.post("/api/py/recommend", json={"budgetMax": -5})
    assert response.status_code == 400
    assert "budgetMax" in response.json()["error"]
    assert client.post("/api/py/recommend", json={"nope": 1}).status_code == 400


def test_recommend_through_mcp(client, monkeypatch):
    monkeypatch.setattr(mcp_client, "_server_override", fake_server())
    response = client.post("/api/py/recommend", json={"budgetMax": 2000, "petFriendly": True, "vibe": 2})
    assert response.status_code == 200
    body = response.json()
    assert [r["zip"] for r in body["results"]] == ["33145", "33010"]  # zip normalized to 5 chars
    assert [r["rank"] for r in body["results"]] == [1, 2]
    assert body["results"][0]["reason"] == "33145 fits you."
    assert body["appliedFilters"]["budgetMax"] == 2000
    assert body["meta"] == {"zipsScored": 3, "matched": 2}


def test_empty_result_is_200(client, monkeypatch):  # AT-4
    monkeypatch.setattr(mcp_client, "_server_override", fake_server())
    response = client.post("/api/py/recommend", json={"budgetMax": 800})
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_explain_failure_uses_template_reason(client, monkeypatch):
    monkeypatch.setattr(mcp_client, "_server_override", fake_server(explain_ok=False))
    body = client.post("/api/py/recommend", json={"budgetMax": 2200}).json()
    assert body["results"][0]["reason"].startswith("Coconut Grove ranks #1")


def test_chat_matches_map_ranking(client, monkeypatch):  # AT-6 / AT-7
    monkeypatch.setattr(mcp_client, "_server_override", fake_server())
    chat = client.post(
        "/api/py/chat", json={"messages": [{"role": "user", "content": "quiet place under 2k that allows dogs"}]}
    ).json()
    understood = chat["understoodFilters"]
    assert (understood["budgetMax"], understood["petFriendly"], understood["vibe"]) == (2000, True, 2)
    map_body = client.post("/api/py/recommend", json=understood).json()
    assert [r["zip"] for r in chat["results"]] == [r["zip"] for r in map_body["results"]]


def test_zip_details(client, monkeypatch):
    monkeypatch.setattr(mcp_client, "_server_override", fake_server())
    body = client.post("/api/py/zip-details", json={"zip": "33133"}).json()
    assert body["zip"] == "33133" and body["reason"] == "33133 fits you."


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
