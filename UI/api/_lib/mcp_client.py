"""MCP client skeleton — the ONLY place the backend talks to the recommendation engine.

The MCP server is not built yet. Until MCP_SERVER_URL is set, every call raises
McpNotConfigured and the API answers 503 (the UI shows its Retry state).

To connect the real server later:
  1. Deploy it with the Streamable HTTP transport exposing the three tools below.
  2. Set MCP_SERVER_URL (and MCP_API_KEY if it needs a bearer token) in Vercel env vars.
No other backend change is needed as long as the tools follow the contracts in UI/PRD.md.
"""

import asyncio
import json
import os
from typing import Any

from mcp import Client

# Tool names agreed in the PRD ("MCP tools" table).
SCORE_ZIPS = "score_zips"
GET_ZIP_DETAILS = "get_zip_details"
EXPLAIN_FIT = "explain_fit"

DEFAULT_TIMEOUT_S = 8.0  # Map target is < 5 s end to end; leave headroom for cold starts.


class McpNotConfigured(RuntimeError):
    """MCP_SERVER_URL is empty: the engine has not been connected yet."""


class McpError(RuntimeError):
    """The MCP server was unreachable, timed out, or the tool reported an error."""


# Tests (or a local in-process server) can set this to an MCPServer instance.
_server_override: Any = None


def is_configured() -> bool:
    return _server_override is not None or bool(os.getenv("MCP_SERVER_URL", "").strip())


def _parse_result(result: Any) -> Any:
    if getattr(result, "is_error", False):
        text = " ".join(getattr(block, "text", "") for block in result.content).strip()
        raise McpError(text or "MCP tool returned an error.")
    structured = getattr(result, "structured_content", None)
    if structured is not None:
        # FastMCP-style servers wrap non-object returns as {"result": ...}.
        if isinstance(structured, dict) and set(structured) == {"result"}:
            return structured["result"]
        return structured
    for block in result.content:
        text = getattr(block, "text", None)
        if text is None:
            continue
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text
    return None


async def _call(name: str, arguments: dict[str, Any]) -> Any:
    if _server_override is not None:
        async with Client(_server_override) as client:
            return _parse_result(await client.call_tool(name, arguments))

    url = os.getenv("MCP_SERVER_URL", "").strip()
    if not url:
        raise McpNotConfigured("MCP_SERVER_URL is not set.")

    from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client

    api_key = os.getenv("MCP_API_KEY", "").strip()
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
    async with create_mcp_http_client(headers=headers) as http:
        async with Client(streamable_http_client(url, http_client=http)) as client:
            return _parse_result(await client.call_tool(name, arguments))


async def call_tool(name: str, arguments: dict[str, Any], timeout: float = DEFAULT_TIMEOUT_S) -> Any:
    """Call one MCP tool and return its JSON payload (dict, list or str)."""
    if not is_configured():
        raise McpNotConfigured("MCP_SERVER_URL is not set.")
    try:
        return await asyncio.wait_for(_call(name, arguments), timeout=timeout)
    except (McpNotConfigured, McpError):
        raise
    except asyncio.TimeoutError as exc:
        raise McpError(f"MCP tool '{name}' timed out after {timeout:.0f} s.") from exc
    except Exception as exc:  # connection refused, protocol errors, ...
        raise McpError(f"MCP tool '{name}' failed: {type(exc).__name__}") from exc
