# Checkpoint 004: Facial Recognition Access Control
**Date:** 2026-03-21
**Branch:** `gonzei/face-access`
**Author:** Gonzei (Role 2 + Role 5)

---

## What was done

### New feature: Face recognition access control system
Security cameras outside rooms scan faces, match against registered users,
check if they have a valid booking, and send real-time alerts to admin
dashboards when unauthorized access is detected.

### 1. Pydantic models (`models/schemas.py`)
- Added `unauthorized_access` to `AnomalyType` enum
- New models: `FaceRegisterRequest`, `FaceRegisterResponse`, `FaceVerifyRequest`, `FaceVerifyResponse`, `AccessLogEntry`

### 2. Face service layer (`services/face_service.py`)
- Uses `face_recognition` library (dlib-based, HOG detector, CPU-only)
- In-memory face registry: `user_id → 128-d encoding vector`
- In-memory access log (last 500 entries)
- All CPU-bound calls wrapped in `asyncio.to_thread()` to keep event loop responsive
- Functions: `register_face`, `identify_face`, `check_booking_validity`, `log_access`, `remove_face`
- Match tolerance: 0.5 (configurable)
- Handles invalid images gracefully (returns None, no crash)

### 3. Face access endpoints (`routers/face_access.py`)
- `POST /api/face/register` — authenticated user registers own face
- `POST /api/face/register/{user_id}` — admin registers face for any user
- `DELETE /api/face/register/{user_id}` — admin removes face encoding
- `POST /api/face/verify` — camera sends frame, gets match result + booking check
- `GET /api/face/access-log` — admin views recent scan attempts
- `GET /api/face/status` — admin sees registered count + recent alerts

### 4. Camera API key auth (`middleware/auth.py`)
- `require_camera_key` dependency validates `X-Camera-Key` header
- Key from `CAMERA_API_KEY` env var (default: `dev-camera-key`)
- Separate from JWT auth — cameras are trusted devices, not user sessions

### 5. Camera client (`camera_client/camera_client.py`)
- Standalone Python script for webcam or RTSP camera feeds
- Webcam mode: `--source webcam`
- RTSP mode: `--source rtsp://user:pass@camera-ip/stream` (for Reolink RLC-510WA)
- Captures frame every N seconds, sends to `/api/face/verify`
- Optional `--show-feed` flag shows live feed with colored overlay:
  - Green border = authorized (has booking)
  - Red border = unauthorized (no booking or unrecognized)
  - Yellow border = error
- CLI args: `--api-url, --room-id, --camera-key, --source, --interval, --show-feed`

### 6. Demo mode simulation (`routers/demo.py`)
- Added `unauthorized_access` alerts to demo simulation (~8% chance per tick)
- Broadcasts `access_alert` events via WebSocket for admin dashboard

---

## Files changed/added
- `models/schemas.py` — modified (new models + enum value)
- `services/face_service.py` — new
- `routers/face_access.py` — new
- `middleware/auth.py` — modified (added `require_camera_key`)
- `routers/demo.py` — modified (unauthorized_access simulation)
- `main.py` — modified (registered face_access router)
- `requirements.txt` — modified (face_recognition, numpy, Pillow, setuptools<81)
- `camera_client/camera_client.py` — new
- `camera_client/requirements.txt` — new

## Dependencies added
- `face_recognition==1.3.0` (dlib-based face recognition)
- `numpy` (face encoding vectors)
- `Pillow` (image processing)
- `setuptools<81` (face_recognition_models needs pkg_resources)
- Camera client: `opencv-python-headless`, `requests`

## Verified
- App starts clean with face_access router
- Face registration endpoint works (200)
- Camera key auth enforced (401 without key)
- Invalid images handled gracefully (no crash)
- Blank images return `recognized: false` with `alert_sent: true`
- Access log captures scan attempts
- Status endpoint shows registered count
- All 6 face endpoints visible in `/docs`
- Demo mode emits `access_alert` events

## What's next
- Phase 6: Claude Vision analytics (stretch — deeper analysis of unauthorized access)
- Real webcam end-to-end test with actual faces
- Wire to real DB when Role 1 delivers schema
- Server deployment with system deps (cmake, libboost)
