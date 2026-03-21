# Checkpoint 001: API Stubs + Auth Middleware
**Date:** 2026-03-21
**Branch:** `gonzei/api-stubs`
**Author:** Gonzei (Role 2)

---

## What was done

### Project structure
- Cleaned up duplicate root-level `backend/` and `frontend/` dirs
- All work lives inside `PirateFlow/`
- Replaced Flask `app.py` with FastAPI `main.py`
- Created `requirements.txt` with all Python deps

### Backend module layout
```
PirateFlow/backend/
├── main.py                  ← App entry, all routers wired, static file serving
├── models/
│   └── schemas.py           ← All Pydantic models (enums, request/response types)
├── middleware/
│   └── auth.py              ← JWT auth dependency + role-based access control
├── routers/
│   ├── auth.py              ← POST /api/auth/login, /refresh, GET /me
│   ├── buildings.py         ← GET /api/buildings, /{id}
│   ├── rooms.py             ← GET /api/rooms (filtered, paginated), /{id}, /{id}/availability
│   ├── bookings.py          ← POST /api/bookings, GET list/detail, PATCH cancel
│   ├── analytics.py         ← GET utilization, heatmap, peak-hours, by-department, revenue, opportunity
│   ├── ai.py                ← POST /api/ai/search, GET /recommendations, POST /predict, /anomalies
│   ├── websocket.py         ← WS /ws + ConnectionManager singleton
│   └── demo.py              ← POST /api/demo/start, /stop, GET /status
└── services/                ← Empty, for AI service layer (Role 5)
```

### Auth enforcement (verified with smoke tests)
| Endpoint group | Auth level | Tested |
|---|---|---|
| `/api/auth/*` | None (public) | Yes |
| `/api/health` | None (public) | Yes |
| `/api/buildings/*` | Any authenticated | Yes |
| `/api/rooms/*` | Any authenticated | Yes |
| `/api/bookings/*` | Authenticated, scoped by role | Yes |
| `/api/analytics/*` | Admin only | Yes |
| `/api/ai/search`, `/recommendations` | Any authenticated | Yes |
| `/api/ai/predict`, `/anomalies` | Admin only | Yes |
| `/api/demo/*` | Admin only | Yes |

### Stub tokens for development
| Token | Role | Login email |
|---|---|---|
| `stub-access-token` | admin | admin@shu.edu |
| `stub-staff-token` | staff | staff@shu.edu |
| `stub-student-token` | student | student@shu.edu |

Password for all: `openshu2026`

### Deployment
- `deploy-pirateflow.sh` created for Pi CI/CD
- Pi deploy script updated to delegate to our custom script
- systemd `app.service` created on old Pi (may need recreation on new server)
- Cloudflare tunnel config updated for `pirateflow.net`
- DNS CNAME added for `pirateflow.net` pointing to tunnel

---

## What's next
- [ ] WebSocket improvements (heartbeat, auth on connect)
- [ ] Rate limiting middleware (auth + AI endpoints)
- [ ] Consistent error response format
- [ ] Static file serving hardening for React Router
- [ ] Wait for Role 1 to deliver DB schema, then replace stub data with real queries
- [ ] Wait for Role 5 to deliver AI service, then replace stub AI responses
- [ ] New server setup (old Pi disabled)

---

## Known issues
- Stub data is hardcoded in routers (will be replaced with DB queries from Role 1)
- `_decode_token()` in `middleware/auth.py` accepts any token as admin (stub behavior)
- WebSocket accepts all connections without auth validation
- `RoomOut.upcoming_bookings` references `BookingOut` via forward ref (works due to `from __future__ import annotations`)
- Old Pi services disabled; new server pending setup
