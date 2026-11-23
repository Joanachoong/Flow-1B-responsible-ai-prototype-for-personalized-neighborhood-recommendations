"""Thin Python backend (Vercel Python function).

Browser -> /api/py/* -> this file -> MCP tools (score_zips, get_zip_details, explain_fit).
It validates input, forwards calls to the MCP server, and shapes the response.
It contains NO scoring logic: ranking lives in the MCP server.
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from _lib import mcp_client  # noqa: E402
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

EXPLAIN_TIMEOUT_S = 4.0  # PRD: if explain_fit takes over 4 s, use template reasons

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


def _normalize_scored(payload: Any) -> tuple[list[ZipResult], Meta]:
    """score_zips may return a bare list of ZipResult or {results, meta}."""
    if isinstance(payload, dict):
        raw, meta = payload.get("results", []), Meta.model_validate(payload.get("meta") or {})
    elif isinstance(payload, list):
        raw, meta = payload, Meta()
    else:
        raise EngineUnavailable("Recommendation engine returned an unexpected response.", 500)
    results = [ZipResult.model_validate(item) for item in raw]
    for index, result in enumerate(results, start=1):
        result.rank = result.rank or index
    if not meta.matched:
        meta.matched = len(results)
    return results, meta


async def _explain(result: ZipResult, prefs: Preferences) -> str:
    try:
        reason = await mcp_client.call_tool(
            mcp_client.EXPLAIN_FIT,
            {
                "zip": result.zip,
                "preferences": prefs.model_dump(exclude_none=True),
                "features": [f.model_dump() for f in result.features],
            },
            timeout=EXPLAIN_TIMEOUT_S,
        )
        if isinstance(reason, dict):
            reason = reason.get("reason", "")
        return str(reason).strip() or template_reason(result, prefs)
    except Exception:
        return template_reason(result, prefs)


async def _fill_reasons(results: list[ZipResult], prefs: Preferences) -> None:
    missing = [r for r in results if not r.reason.strip()]
    reasons = await asyncio.gather(*(_explain(r, prefs) for r in missing))
    for result, reason in zip(missing, reasons):
        result.reason = reason


async def _score(prefs: Preferences) -> tuple[list[ZipResult], Meta]:
    payload = await _tool(mcp_client.SCORE_ZIPS, {"preferences": prefs.model_dump(exclude_none=True)})
    results, meta = _normalize_scored(payload)
    results = results[: prefs.topN]
    await _fill_reasons(results, prefs)
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
    payload = await _tool(
        mcp_client.GET_ZIP_DETAILS,
        {"zip": body.zip, "preferences": body.preferences.model_dump(exclude_none=True)},
    )
    if isinstance(payload, dict) and "result" in payload and "zip" not in payload:
        payload = payload["result"]
    result = ZipResult.model_validate(payload)
    if not result.reason.strip():
        result.reason = await _explain(result, body.preferences)
    return result


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
