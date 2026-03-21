"""
Webhook logging middleware for PirateFlow.
Sends critical events to Discord and creates GitHub Issues for serious errors.

Events logged:
- Server startup / shutdown
- 404 Not Found errors
- 500 Internal Server errors
- Auth failures (401 / 403)
- Slow requests (> 2 seconds)
- Camera / face recognition alerts
"""

import os
import time
import traceback
import httpx
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# ─── Config (lazy — read after load_dotenv runs) ──────────────────────────────
SLOW_REQUEST_THRESHOLD = 2.0

COLOR_RED    = 0xe8445a
COLOR_YELLOW = 0xf5a623
COLOR_GREEN  = 0x00c896
COLOR_BLUE   = 0x00bfff

def _discord_url():
    return os.getenv("DISCORD_WEBHOOK_URL", "")

def _github_token():
    return os.getenv("GITHUB_TOKEN", "")

def _github_repo():
    return os.getenv("GITHUB_REPO", "poncema4/PirateFlow")


# ─── Discord ──────────────────────────────────────────────────────────────────
async def send_discord(title: str, description: str, color: int, fields: list = None):
    url = _discord_url()
    if not url:
        return
    embed = {
        "title": title,
        "description": description,
        "color": color,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": "PirateFlow — Campus Space Intelligence"},
    }
    if fields:
        embed["fields"] = fields
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, json={"embeds": [embed]})
    except Exception:
        pass


# ─── GitHub Issues ────────────────────────────────────────────────────────────
async def create_github_issue(title: str, body: str, labels: list = None):
    token = _github_token()
    repo  = _github_repo()
    if not token or not repo:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.github.com/repos/{repo}/issues",
                json={"title": title, "body": body, "labels": labels or ["bug", "automated"]},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
    except Exception:
        pass


# ─── Middleware ───────────────────────────────────────────────────────────────
class WebhookLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start  = time.time()
        path   = request.url.path
        method = request.method

        if not path.startswith("/api") and path != "/ws":
            return await call_next(request)

        try:
            response = await call_next(request)
        except Exception as exc:
            duration = time.time() - start
            tb = traceback.format_exc()
            await send_discord(
                title="🔥 500 Internal Server Error",
                description=f"**{method} {path}** crashed after `{duration:.2f}s`",
                color=COLOR_RED,
                fields=[
                    {"name": "Error",     "value": f"```{str(exc)[:500]}```", "inline": False},
                    {"name": "Traceback", "value": f"```{tb[:800]}```",       "inline": False},
                ],
            )
            await create_github_issue(
                title=f"🔥 500 Error: {method} {path}",
                body=(
                    f"## Unhandled Exception\n\n"
                    f"**Route:** `{method} {path}`\n"
                    f"**Duration:** `{duration:.2f}s`\n"
                    f"**Time:** `{datetime.now(timezone.utc).isoformat()}`\n\n"
                    f"### Error\n```\n{str(exc)}\n```\n\n"
                    f"### Traceback\n```\n{tb[:2000]}\n```"
                ),
                labels=["bug", "500-error", "automated"],
            )
            raise

        duration = time.time() - start
        status   = response.status_code

        if status == 404:
            await send_discord(
                title="🔍 404 Not Found",
                description=f"**{method} {path}** returned 404",
                color=COLOR_YELLOW,
                fields=[{"name": "Duration", "value": f"`{duration:.2f}s`", "inline": True}],
            )

        elif status in (401, 403):
            label     = "Unauthorized" if status == 401 else "Forbidden"
            client_ip = request.client.host if request.client else "unknown"
            await send_discord(
                title=f"🔒 {status} {label}",
                description=f"**{method} {path}** — auth failure from `{client_ip}`",
                color=COLOR_YELLOW,
                fields=[{"name": "Duration", "value": f"`{duration:.2f}s`", "inline": True}],
            )

        elif status >= 500:
            await send_discord(
                title=f"🔥 {status} Server Error",
                description=f"**{method} {path}** returned {status}",
                color=COLOR_RED,
                fields=[{"name": "Duration", "value": f"`{duration:.2f}s`", "inline": True}],
            )
            await create_github_issue(
                title=f"🔥 {status} Error: {method} {path}",
                body=(
                    f"## Server Error Response\n\n"
                    f"**Route:** `{method} {path}`\n"
                    f"**Status:** `{status}`\n"
                    f"**Duration:** `{duration:.2f}s`\n"
                    f"**Time:** `{datetime.now(timezone.utc).isoformat()}`\n"
                ),
                labels=["bug", "server-error", "automated"],
            )

        if duration > SLOW_REQUEST_THRESHOLD and status < 500:
            await send_discord(
                title="🐢 Slow Request Detected",
                description=f"**{method} {path}** took `{duration:.2f}s`",
                color=COLOR_BLUE,
                fields=[{"name": "Status", "value": f"`{status}`", "inline": True}],
            )

        return response


# ─── Camera Alert Helper ──────────────────────────────────────────────────────
async def log_camera_alert(room_id: str, room_name: str, building_name: str, description: str):
    await send_discord(
        title="📷 Unauthorized Access Detected",
        description=description,
        color=COLOR_RED,
        fields=[
            {"name": "Room",     "value": f"`{room_name}`",     "inline": True},
            {"name": "Building", "value": f"`{building_name}`", "inline": True},
            {"name": "Room ID",  "value": f"`{room_id}`",       "inline": True},
            {"name": "Time",     "value": f"`{datetime.now(timezone.utc).strftime('%H:%M UTC')}`", "inline": True},
        ],
    )
    await create_github_issue(
        title=f"📷 Unauthorized Access: {room_name} — {building_name}",
        body=(
            f"## Unauthorized Access Alert\n\n"
            f"**Room:** `{room_name}` (`{room_id}`)\n"
            f"**Building:** `{building_name}`\n"
            f"**Description:** {description}\n"
            f"**Time:** `{datetime.now(timezone.utc).isoformat()}`\n"
        ),
        labels=["security", "camera-alert", "automated"],
    )


# ─── Install ──────────────────────────────────────────────────────────────────
def install_webhook_logging(app: FastAPI) -> None:
    """Register middleware only. Startup/shutdown handled via lifespan in main.py."""
    app.add_middleware(WebhookLoggingMiddleware)