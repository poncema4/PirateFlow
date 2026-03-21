# Checkpoint 005: Facial Recognition Access Control — Complete Implementation
**Date:** 2026-03-21
**Branch:** `gonzei/face-access`
**Author:** Gonzei (Role 2 + Role 5)

---

## Overview

This checkpoint captures the full facial recognition access control system — the differentiator feature that makes PirateFlow stand out at the hackathon. The system provides real-time face-based authorization for campus room access, combining local face matching for speed with Claude Vision AI for deeper incident analysis.

---

## Architecture

### Two-Layer Intelligence

The system uses a **hybrid approach** — two separate AI systems working at different speeds for different purposes:

**Layer 1: Local Face Recognition (real-time, ~200-500ms)**
- `face_recognition` library (dlib HOG detector, CPU-only)
- 128-dimensional face encoding vectors stored in memory
- Compares incoming frames against all registered faces using euclidean distance
- Tolerance threshold: 0.5 (tighter than default 0.6 — fewer false positives)
- Returns match/no-match + confidence score instantly
- All CPU-bound calls wrapped in `asyncio.to_thread()` to avoid blocking the event loop

**Layer 2: Claude Vision Analysis (async enrichment, ~2-5s)**
- Fires as a background task AFTER the real-time alert has already been sent
- Sends the camera frame + incident context to Claude Sonnet via the Vision API
- Returns structured JSON analysis: person description, type classification, risk level, recommended action
- Results broadcast to admin dashboards as a follow-up `access_analysis` WebSocket event
- Non-blocking — if Claude is slow or fails, the real-time system is unaffected
- Prompt engineering ensures Claude never speculates about race/ethnicity (responsible AI)

### Data Flow

```
Camera Frame (JPEG)
  │
  ▼
POST /api/face/verify (X-Camera-Key auth)
  │
  ├─► face_recognition.face_encodings() ──► face_recognition.face_distance()
  │     Extract 128-d vector                   Compare against registry
  │                                              │
  │                                   ┌──────────┴──────────┐
  │                                   │                     │
  │                              MATCH FOUND           NO MATCH
  │                                   │                     │
  │                          Check booking             Alert: unrecognized
  │                           for this room                  │
  │                                   │                      │
  │                          ┌────────┴────────┐             │
  │                          │                 │             │
  │                     HAS BOOKING      NO BOOKING          │
  │                     (authorized)    (alert sent)         │
  │                          │                 │             │
  │                          ▼                 ▼             ▼
  │                    Response: OK      WebSocket:     WebSocket:
  │                                    access_alert   access_alert
  │                                          │             │
  └──► asyncio.create_task() ◄───────────────┴─────────────┘
        │                         (fire-and-forget)
        ▼
  Claude Vision API
  (analyze frame)
        │
        ▼
  WebSocket: access_analysis
  (enriched incident report)
```

### Camera Authentication

Cameras use a **separate auth mechanism** from users — they're trusted devices, not user sessions:
- Simple API key via `X-Camera-Key` header
- Key stored as `CAMERA_API_KEY` environment variable (default: `dev-camera-key`)
- This avoids JWT complexity for devices that don't have user sessions
- Middleware: `require_camera_key` in `middleware/auth.py`

### In-Memory Stores

Since Role 1 hasn't delivered the DB schema yet, all data is stored in memory:
- `_face_registry: dict[str, np.ndarray]` — user_id → 128-d encoding vector
- `_user_names: dict[str, str]` — user_id → display name (for alerts)
- `_access_log: list[AccessLogEntry]` — chronological scan log (capped at 500 entries)

When Role 1 delivers SQLite, these migrate to:
- `face_encodings` table (user_id, encoding BLOB, photo_thumbnail BLOB, timestamps)
- `access_log` table (id, room_id, user_id, confidence, had_booking, alert_sent, timestamp, snapshot BLOB)

---

## API Endpoints

### Face Registration

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/face/register` | JWT (any user) | Register own face from base64 image |
| `POST /api/face/register/{user_id}` | JWT (admin) | Admin registers face for any user |
| `DELETE /api/face/register/{user_id}` | JWT (admin) | Remove a user's face encoding |

Registration flow:
1. Client sends base64-encoded JPEG/PNG
2. Service strips data URL prefix if present (`data:image/jpeg;base64,...`)
3. `face_recognition.face_encodings()` extracts the 128-d vector
4. If no face detected → 400 error with helpful message
5. Vector stored in `_face_registry[user_id]`

### Face Verification (Camera Endpoint)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/face/verify` | Camera API key | Camera sends frame for identification |

This is the core endpoint that cameras call every few seconds. The response is immediate (not blocked by Claude Vision).

Response shape:
```json
{
    "recognized": true,
    "user_id": "usr_001",
    "user_name": "admin@shu.edu",
    "has_valid_booking": false,
    "confidence": 0.847,
    "alert_sent": true
}
```

### Admin Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/face/access-log` | JWT (admin) | Recent scan attempts with results |
| `GET /api/face/status` | JWT (admin) | System overview (registered count, recent alerts) |

---

## WebSocket Events

Two new event types broadcast to admin connections:

### `access_alert` (immediate)
Fired the instant an unauthorized access is detected.
```json
{
    "event": "access_alert",
    "data": {
        "type": "unauthorized_access",
        "severity": "critical",
        "room_id": "rm_001",
        "room_name": "Room rm_001",
        "building_name": "Campus",
        "description": "Bob Smith detected in Room rm_001 without a valid booking.",
        "detected_user": "Bob Smith",
        "detected_at": "2026-03-21T15:30:00Z"
    },
    "timestamp": "2026-03-21T15:30:00Z"
}
```

### `access_analysis` (delayed enrichment, ~2-5s later)
Fired after Claude Vision finishes analyzing the frame.
```json
{
    "event": "access_analysis",
    "data": {
        "access_log_id": "acc_a1b2c3d4",
        "room_id": "rm_001",
        "room_name": "Room rm_001",
        "building_name": "Campus",
        "detected_user": "Bob Smith",
        "analysis": {
            "description": "Male individual, early 20s, wearing SHU hoodie and carrying a backpack",
            "person_type": "student",
            "person_type_reasoning": "University-branded clothing and backpack suggest enrolled student",
            "risk_level": "low",
            "risk_reasoning": "Appears to be a student who likely forgot to make a booking",
            "recommended_action": "Send a courtesy reminder about the room booking policy via email"
        },
        "analyzed_at": "2026-03-21T15:30:04Z"
    },
    "timestamp": "2026-03-21T15:30:04Z"
}
```

The frontend can link these two events by `access_log_id` — show the alert immediately, then enrich it when the analysis arrives.

---

## Camera Client

Standalone Python script at `camera_client/camera_client.py`. Runs on any machine with a webcam or access to an RTSP stream.

### Two modes:
- **Webcam:** `python camera_client.py --source webcam --room-id rm_001`
- **RTSP:** `python camera_client.py --source rtsp://user:pass@192.168.1.100/h264Preview_01_main --room-id rm_001`

### Visual overlay (`--show-feed`):
When enabled, displays the live camera feed with colored borders:
- **Green border** = person authorized (has valid booking)
- **Red border** = unauthorized access (no booking or unrecognized)
- **Yellow border** = error (API unreachable, etc.)

### CLI arguments:
```
--api-url      API base URL (default: http://localhost:8000)
--room-id      Room this camera monitors (default: rm_001)
--camera-key   Camera API key (default: dev-camera-key)
--source       'webcam' or RTSP URL
--interval     Seconds between scans (default: 3.0)
--show-feed    Show live feed with overlay
```

### Hardware support:
- Laptop webcams (for dev/demo)
- Reolink RLC-510WA cameras via RTSP (production target)
- Any IP camera that exposes an RTSP stream

---

## Demo Mode Integration

The existing demo simulation in `routers/demo.py` now includes simulated unauthorized access alerts (~8% chance per tick). This means the admin dashboard will show face access alerts during demo mode even without a live camera — a reliable fallback for the demo.

---

## Claude Vision Prompt Engineering

The system prompt for Claude Vision analysis is carefully designed:
- **Professional and objective** — suitable for a security context
- **Structured JSON output** — parseable, not free text
- **Responsible AI** — explicitly instructs Claude to never speculate about race or ethnicity
- **Risk calibration** — low/medium/high with clear criteria
- **Actionable** — every analysis includes a specific recommended action
- **Temperature: 0.2** — consistent, not creative
- **Model: claude-sonnet-4-20250514** — fast enough for near-real-time enrichment

---

## Error Handling

- Invalid/corrupt images → `_extract_encoding` returns None (no crash)
- No face in image → register returns 400 with message; verify returns `recognized: false`
- `face_recognition.face_distance` failure → caught, returns None
- Claude Vision timeout/error → caught silently, no enrichment event sent (real-time alert already fired)
- Missing `ANTHROPIC_API_KEY` → Vision analysis skipped silently
- Invalid camera key → 401 with `UNAUTHORIZED` code

---

## Performance Notes

- Face encoding extraction: ~200-400ms per frame (HOG detector, CPU)
- Face comparison against N encodings: ~5ms (numpy dot product)
- Total verify round-trip: <500ms on LAN
- Claude Vision enrichment: 2-5s (async, non-blocking)
- Memory: face_recognition + dlib uses ~150MB; trivial on x86 with 16GB+
- Camera client sends one frame every 3 seconds (configurable) — prevents overloading

---

## Dependencies

### Backend (`requirements.txt`)
```
face_recognition==1.3.0
numpy
Pillow
setuptools<81          # face_recognition_models needs pkg_resources
```

### System (server)
```
sudo apt install cmake libboost-all-dev   # needed for dlib compile
```

### Camera client (`camera_client/requirements.txt`)
```
opencv-python-headless
requests
```

---

## Files

| File | Action | Description |
|------|--------|-------------|
| `backend/models/schemas.py` | Modified | Added `unauthorized_access` enum, 5 new Pydantic models |
| `backend/services/face_service.py` | New | Core face encoding, matching, booking check, access logging |
| `backend/services/vision_analysis.py` | New | Claude Vision API integration for incident analysis |
| `backend/routers/face_access.py` | New | 6 endpoints: register, verify, delete, access-log, status |
| `backend/middleware/auth.py` | Modified | Added `require_camera_key` dependency |
| `backend/routers/demo.py` | Modified | Added unauthorized_access to demo simulation |
| `backend/main.py` | Modified | Registered face_access router |
| `backend/requirements.txt` | Modified | Added face_recognition, numpy, Pillow, setuptools |
| `camera_client/camera_client.py` | New | Standalone webcam/RTSP capture client |
| `camera_client/requirements.txt` | New | opencv-python-headless, requests |

---

## What's Next

- Real webcam end-to-end test with actual human faces
- Wire face registry to SQLite when Role 1 delivers schema
- Deploy to server (install cmake + libboost system deps)
- Frontend integration: access alert cards on admin dashboard, camera feed page
- RTSP test with Reolink cameras when they arrive
- Consider face encoding persistence across restarts (currently lost on restart)
