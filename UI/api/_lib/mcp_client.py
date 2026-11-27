"""MCP client: the ONLY place the backend talks to the recommendation engine.

The engine is the team's MCP server in ../src/flow_neighborhoods/mcp_server.py. All ranking
and data lookups happen there; this file only starts it, calls a tool and returns the JSON.

How the server is reached, in order:
  1. Tests can set `_server_override` to an in-process MCPServer instance.
  2. If MCP_SERVER_URL is set, connect to a remote server over Streamable HTTP.
  3. Otherwise (the default for local runs), launch the server from the repo's src/ folder
     as a subprocess over stdio:  python -m flow_neighborhoods.mcp_server
"""

import asyncio
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

from mcp import Client

# Tools exposed by src/flow_neighborhoods/mcp_server.py.
RECOMMEND = "recommend"
AREA_STATS = "area_stats"

DEFAULT_TIMEOUT_S = 15.0  # includes starting the server process (~1 s) and loading the data

REPO_ROOT = Path(__file__).resolve().parents[3]
SRC_DIR = REPO_ROOT / "src"
DATA_DIR = REPO_ROOT / "data"


class McpNotConfigured(RuntimeError):
    """No way to reach the MCP server (no URL, and the src/ server is not in this checkout)."""


class McpError(RuntimeError):
    """The MCP server was unreachable, timed out, or the tool reported an error."""


# Tests (or a local in-process server) can set this to an MCPServer instance.
_server_override: Any = None


def _local_server_available() -> bool:
    return (SRC_DIR / "flow_neighborhoods" / "mcp_server.py").is_file()


def is_configured() -> bool:
    return (
        _server_override is not None
        or bool(os.getenv("MCP_SERVER_URL", "").strip())
        or _local_server_available()
    )


def _parse_result(result: Any) -> Any:
    if getattr(result, "is_error", False):
        text = " ".join(getattr(block, "text", "") for block in result.content).strip()
        raise McpError(text or "MCP tool returned an error.")
    structured = getattr(result, "structured_content", None)
    if structured is not None:
        # Servers wrap non-object returns as {"result": ...}.
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


# --- local data folder -------------------------------------------------------------------

_data_dir: Path | None = None


def _server_data_dir() -> Path:
    """The folder handed to the server as FLOW_DATA_DIR.

    The server expects every CSV in one flat folder, but the repo now keeps them split across
    data/, data/cleaned/ and data/raw/. Instead of changing src/ or data/, link the files into
    one temporary folder outside the repo. Nothing is copied into or changed in the repo.
    Set FLOW_DATA_DIR yourself to skip this.
    """
    global _data_dir
    if _data_dir is not None and _data_dir.is_dir():
        return _data_dir
    target = Path(tempfile.gettempdir()) / "flow-neighborhoods-mcp-data"
    target.mkdir(exist_ok=True)
    sources: dict[str, Path] = {}
    for folder in (DATA_DIR, DATA_DIR / "cleaned", DATA_DIR / "raw"):  # first match wins
        for source in sorted(folder.glob("*.csv")):
            sources.setdefault(source.name, source.resolve())
    for name, source in sources.items():
        link = target / name
        if link.is_symlink():
            if link.resolve() == source:
                continue
            link.unlink()
        try:
            link.symlink_to(source)
        except FileExistsError:  # a copied file from an earlier run
            shutil.copy2(source, link)
        except OSError:  # e.g. Windows without symlink rights
            shutil.copy2(source, link)
    _data_dir = target
    return target


def _stdio_params():
    from mcp.client.stdio import StdioServerParameters

    env = {**os.environ}
    env["PYTHONPATH"] = os.pathsep.join(filter(None, [str(SRC_DIR), env.get("PYTHONPATH", "")]))
    env.setdefault("FLOW_DATA_DIR", str(_server_data_dir()))
    env["PYTHONDONTWRITEBYTECODE"] = "1"  # keep src/ free of __pycache__
    return StdioServerParameters(
        command=os.getenv("MCP_PYTHON", "").strip() or sys.executable,
        args=["-m", "flow_neighborhoods.mcp_server"],
        env=env,
        cwd=str(REPO_ROOT),
    )


# --- calls -------------------------------------------------------------------------------


async def _call(name: str, arguments: dict[str, Any]) -> Any:
    if _server_override is not None:
        async with Client(_server_override) as client:
            return _parse_result(await client.call_tool(name, arguments))

    url = os.getenv("MCP_SERVER_URL", "").strip()
    if url:
        from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client

        api_key = os.getenv("MCP_API_KEY", "").strip()
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
        async with create_mcp_http_client(headers=headers) as http:
            async with Client(streamable_http_client(url, http_client=http)) as client:
                return _parse_result(await client.call_tool(name, arguments))

    if not _local_server_available():
        raise McpNotConfigured("MCP server not found: set MCP_SERVER_URL or run from the repo checkout.")

    from mcp import ClientSession
    from mcp.client.stdio import stdio_client

    async with stdio_client(_stdio_params()) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            return _parse_result(await session.call_tool(name, arguments))


async def call_tool(name: str, arguments: dict[str, Any], timeout: float = DEFAULT_TIMEOUT_S) -> Any:
    """Call one MCP tool and return its JSON payload (dict, list or str)."""
    if not is_configured():
        raise McpNotConfigured("MCP server is not configured.")
    try:
        return await asyncio.wait_for(_call(name, arguments), timeout=timeout)
    except (McpNotConfigured, McpError):
        raise
    except asyncio.TimeoutError as exc:
        raise McpError(f"MCP tool '{name}' timed out after {timeout:.0f} s.") from exc
    except Exception as exc:  # connection refused, protocol errors, process failed to start...
        raise McpError(f"MCP tool '{name}' failed: {type(exc).__name__}") from exc
