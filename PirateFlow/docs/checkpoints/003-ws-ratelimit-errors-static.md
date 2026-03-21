# Checkpoint 003: WebSocket, Rate Limiting, Error Handling, Static Serving
**Date:** 2026-03-21
**Branch:** `gonzei/api-stubs`
**Author:** Gonzei (Role 2)

---

## What was done

### 1. WebSocket improvements (`routers/websocket.py`)
- **Auth on connect**: validates JWT from `?token=` query param via `_decode_token()`; rejects with close code 4001
- **Heartbeat**: server sends `ping` event every 30 seconds to detect dead connections
- **Stale cleanup**: broadcast methods snapshot dict keys before iterating; failed sends auto-remove dead connections
- **Consistent message format**: all server messages use `{"event": "...", "data": {...}, "timestamp": "..."}`

### 2. Rate limiting (`middleware/rate_limit.py`)
- In-memory sliding window approach (dict of timestamps per key)
- Auto-prunes expired entries on each check
- Two dependency factories:
  - `rate_limit_ip(max_requests, window_seconds)` — for login (keyed on CF-Connecting-IP → X-Forwarded-For → client.host)
  - `rate_limit_user(max_requests, window_seconds)` — for AI endpoints (keyed on user_id)
- Applied to:
  - `POST /api/auth/login` — 5 req/min per IP
  - `POST /api/ai/search` — 10 req/min per user
  - `GET /api/ai/recommendations` — 5 req/min per user
- Verified: 6th rapid login request returns 429

### 3. Consistent error handling (`middleware/errors.py`)
- All error responses now follow: `{"detail": "...", "code": "MACHINE_CODE"}`
- Custom handlers installed for:
  - `HTTPException` → maps status to code (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, etc.)
  - `RequestValidationError` → simplifies Pydantic's verbose 422 into readable `"field: message; field: message"`
  - Unhandled `Exception` → returns generic 500 with INTERNAL_ERROR, logs traceback server-side, never leaks internals
- Installed via `install_error_handlers(app)` in main.py

### 4. Static file serving hardening (`main.py`)
- Path traversal protection: resolved path must stay within `STATIC_DIR`
- Graceful handling if `assets/` dir doesn't exist yet (only mounts if present)
- All non-file GET routes serve `index.html` for React Router

---

## Files changed
- `middleware/rate_limit.py` — new
- `middleware/errors.py` — new
- `middleware/auth.py` — removed unused imports
- `routers/websocket.py` — rewritten with auth, heartbeat, cleanup
- `routers/auth.py` — added rate_limit_ip on login
- `routers/ai.py` — added rate_limit_user on search and recommendations
- `main.py` — installed error handlers, hardened static serving

## Verified
- App starts clean
- Auth: 401 without token, 403 for wrong role, 200 with valid token
- Rate limit: 429 after exceeding limit
- Error format: consistent `{"detail", "code"}` across 401, 403, 404, 422, 429

---

## Backend structure (current)
```
PirateFlow/backend/
├── main.py
├── models/
│   └── schemas.py
├── middleware/
│   ├── auth.py              ← JWT dependency + role checker
│   ├── rate_limit.py         ← sliding window rate limiter
│   └── errors.py             ← global error handlers
├── routers/
│   ├── auth.py               ← login (rate limited), refresh, me
│   ├── buildings.py           ← authenticated
│   ├── rooms.py               ← authenticated
│   ├── bookings.py            ← authenticated, scoped by role
│   ├── analytics.py           ← admin only
│   ├── ai.py                  ← search/recs (auth + rate limit), predict/anomalies (admin)
│   ├── websocket.py           ← auth on connect, heartbeat, stale cleanup
│   └── demo.py                ← admin only
└── services/                  ← empty (for AI service layer)
```

## What's next
- Role 2 API work is feature-complete for stubs
- Waiting on Role 1 for DB schema/auth to replace stubs with real data
- Waiting on Role 5 for AI service layer to replace stub AI responses
- Waiting on new server setup to deploy
