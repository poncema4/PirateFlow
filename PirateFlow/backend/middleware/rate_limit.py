"""
In-memory rate limiting for auth and AI endpoints.

Uses a sliding window approach: tracks timestamps of recent requests per key.
Expired entries are pruned on each check to prevent memory leaks.

Usage as a FastAPI dependency:

    # Limit by authenticated user (10 req/min)
    @router.post("/search")
    async def search(
        user: UserPayload = Depends(get_current_user),
        _: None = Depends(rate_limit_user(max_requests=10, window_seconds=60)),
    ):
        ...

    # Limit by client IP (5 req/min)
    @router.post("/login")
    async def login(
        request: Request,
        _: None = Depends(rate_limit_ip(max_requests=5, window_seconds=60)),
    ):
        ...
"""

import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request, status

from middleware.auth import UserPayload, get_current_user


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

# key -> list of request timestamps
_request_log: dict[str, list[float]] = defaultdict(list)


def _check_rate(key: str, max_requests: int, window_seconds: int) -> None:
    """Check if key has exceeded the rate limit. Raises 429 if so."""
    now = time.monotonic()
    timestamps = _request_log[key]

    # Prune expired entries
    cutoff = now - window_seconds
    _request_log[key] = [t for t in timestamps if t > cutoff]
    timestamps = _request_log[key]

    if len(timestamps) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Max {max_requests} requests per {window_seconds} seconds.",
        )

    timestamps.append(now)


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def rate_limit_user(max_requests: int = 10, window_seconds: int = 60):
    """Rate limit by authenticated user ID."""
    async def _dependency(user: UserPayload = Depends(get_current_user)):
        _check_rate(f"user:{user.user_id}", max_requests, window_seconds)

    return _dependency


def rate_limit_ip(max_requests: int = 5, window_seconds: int = 60):
    """Rate limit by client IP address."""
    async def _dependency(request: Request):
        # Cloudflare sets CF-Connecting-IP; fall back to X-Forwarded-For, then client host
        client_ip = (
            request.headers.get("CF-Connecting-IP")
            or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or request.client.host
        )
        _check_rate(f"ip:{client_ip}", max_requests, window_seconds)

    return _dependency
