# Checkpoint 002: WebSocket Improvements
**Date:** 2026-03-21
**Branch:** `gonzei/api-stubs`
**Author:** Gonzei (Role 2)

---

## What was done

### WebSocket auth on connect
- Token is passed as query param: `/ws?token=<jwt>`
- `_decode_token()` from `middleware/auth.py` validates the token
- Missing or invalid token → connection closed with code 4001
- User ID and role extracted from token and stored in ConnectionManager

### Server-side heartbeat
- Background task sends a `ping` event every 30 seconds
- If the connection is dead (client disconnected without close frame), the ping fails and triggers cleanup
- Heartbeat task is cancelled on normal disconnect

### Stale connection cleanup
- `broadcast_to_admins()` and `broadcast_all()` now snapshot dict keys before iterating (prevents dict-changed-during-iteration bug)
- Failed sends during broadcast automatically remove the dead connection
- `send_to_user()` also cleans up on failure

### Client messages
- Client can send `"ping"` text → server responds with `{"event": "pong", "timestamp": "..."}`
- All server messages use consistent JSON format: `{"event": "...", "data": {...}, "timestamp": "..."}`

---

## Verified
- App starts clean with updated WebSocket code
- No import errors or circular dependencies

---

## What's next
- Rate limiting middleware (auth + AI endpoints)
- Consistent error response format
- Static file serving hardening
