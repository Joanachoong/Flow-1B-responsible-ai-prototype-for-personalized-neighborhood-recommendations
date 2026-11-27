"""Thin Python backend (Vercel Python function).

Browser -> /api/py/* -> this file -> MCP server in ../src (tools: recommend, area_stats).
It validates input, forwards calls to the MCP server, and renames fields for the UI
(_lib/engine_adapter.py). It contains NO scoring logic: ranking lives in the MCP server.
"""

import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from _lib import engine_adapter, mcp_client  # noqa: E402
from _lib.chat_agent import extract_preferences, summarize  # noqa: E402
from _lib.models import (  # noqa: E402
    ChatRequest,
    ChatResponse,
    Meta,
    Preferences,
    RecommendResponse,
    ZipDetailsRequest,
    ZipResult,
)
from _lib.reasons import template_reason  # noqa: E402

app = FastAPI(title="Miami Zip Recommender API", docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")


class EngineUnavailable(Exception):
    def __init__(self, message: str, status: int):
        self.message, self.status = message, status


@app.exception_handler(RequestValidationError)
async def bad_input(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    return JSONResponse(status_code=400, content={"error": f"{where}: {first.get('msg', 'invalid input')}"})


@app.exception_handler(EngineUnavailable)
async def engine_unavailable(_: Request, exc: EngineUnavailable) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"error": exc.message})


@app.exception_handler(Exception)
async def unexpected(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": "Something went wrong. Please try again."})


async def _tool(name: str, arguments: dict[str, Any], timeout: float = mcp_client.DEFAULT_TIMEOUT_S) -> Any:
    try:
        return await mcp_client.call_tool(name, arguments, timeout=timeout)
    except mcp_client.McpNotConfigured as exc:
        raise EngineUnavailable("Recommendation engine not connected yet.", 503) from exc
    except mcp_client.McpError as exc:
        raise EngineUnavailable(f"Recommendation engine unavailable: {exc}", 503) from exc


async def _score(prefs: Preferences) -> tuple[list[ZipResult], Meta]:
    """Ranking comes from the engine's `recommend` tool, unchanged."""
    payload = await _tool(mcp_client.RECOMMEND, engine_adapter.to_recommend_args(prefs))
    try:
        results, meta = engine_adapter.from_recommendation(payload)
    except (ValueError, KeyError, TypeError) as exc:
        raise EngineUnavailable("Recommendation engine returned an unexpected response.", 500) from exc
    for result in results:
        # The engine has no explanation tool; build the sentence from the values it returned.
        result.reason = template_reason(result, prefs)
    return results, meta


@app.get("/api/py/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "mcpConfigured": mcp_client.is_configured(),
        "llmConfigured": bool(os.getenv("GEMINI_API_KEY", "").strip()),
    }


@app.post("/api/py/recommend", response_model=RecommendResponse)
async def recommend(prefs: Preferences) -> RecommendResponse:
    results, meta = await _score(prefs)
    return RecommendResponse(results=results, appliedFilters=prefs.model_dump(exclude_none=True), meta=meta)


@app.post("/api/py/zip-details", response_model=ZipResult)
async def zip_details(body: ZipDetailsRequest) -> ZipResult:
    """The ZIP's entry in the engine's ranking if it is a top match, else its area_stats."""
    results, _ = await _score(body.preferences)
    for result in results:
        if result.zip == body.zip:
            return result
    payload = await _tool(mcp_client.AREA_STATS, {"zip_code": body.zip})
    if not isinstance(payload, dict) or payload.get("status") != "ok":
        raise EngineUnavailable("No data for this zip in the engine's snapshot.", 404)
    return engine_adapter.from_area_stats(payload)


@app.post("/api/py/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    prefs, _parser = await extract_preferences(body.messages, body.context)
    results, meta = await _score(prefs)
    return ChatResponse(
        reply=summarize(prefs, len(results)),
        understoodFilters=prefs.model_dump(exclude_none=True),
        results=results,
        meta=meta,
    )
