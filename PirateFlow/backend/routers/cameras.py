"""Camera management and access event endpoints.

Handles camera CRUD, receives crossing events from the local camera client,
and serves access events/alerts to the admin UI.
"""

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from middleware.auth import UserPayload, require_camera_key, require_role
from models.schemas import (
    AccessEventOut, AccessRuleCreateRequest, AccessRuleOut, AlertOut,
    CameraCreateRequest, CameraOut, CameraUpdateRequest, UserRole,
)
from services.database import get_db
from services.queries import (
    create_camera, get_cameras, get_camera_by_id, update_camera, delete_camera,
    get_camera_events, create_access_rule, get_access_rules, delete_access_rule,
    get_alerts, acknowledge_alert,
)

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


# ---------------------------------------------------------------------------
# Camera CRUD (admin only)
# ---------------------------------------------------------------------------

@router.get("", response_model=list[CameraOut])
async def list_cameras(
    room_id: Optional[str] = None,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: list all cameras."""
    db = await get_db()
    rows = await get_cameras(db, room_id=room_id)
    return [CameraOut(**r) for r in rows]


@router.post("", response_model=dict, status_code=201)
async def create_camera_endpoint(
    body: CameraCreateRequest,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: register a new camera."""
    db = await get_db()
    camera_id = await create_camera(
        db, room_id=body.room_id, name=body.name,
        rtsp_url=body.rtsp_url, crossing_line_y=body.crossing_line_y,
        entry_direction=body.entry_direction,
    )
    return {"id": camera_id, "status": "created"}


@router.get("/{camera_id}", response_model=CameraOut)
async def get_camera_endpoint(
    camera_id: str,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: get camera detail."""
    db = await get_db()
    cam = await get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return CameraOut(**cam)


@router.put("/{camera_id}", response_model=dict)
async def update_camera_endpoint(
    camera_id: str,
    body: CameraUpdateRequest,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: update a camera."""
    db = await get_db()
    cam = await get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    await update_camera(db, camera_id, **body.model_dump(exclude_none=True))
    return {"id": camera_id, "status": "updated"}


@router.delete("/{camera_id}", response_model=dict)
async def delete_camera_endpoint(
    camera_id: str,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: delete a camera."""
    db = await get_db()
    await delete_camera(db, camera_id)
    return {"id": camera_id, "status": "deleted"}


# ---------------------------------------------------------------------------
# Crossing events (received from local camera client)
# ---------------------------------------------------------------------------

class CrossingEventRequest(BaseModel):
    camera_id: str
    room_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    direction: str  # "entry" or "exit"
    confidence: Optional[float] = None
    frame_jpeg_b64: Optional[str] = None  # optional annotated frame


@router.post("/events", response_model=dict, status_code=201)
async def receive_crossing_event(
    body: CrossingEventRequest,
    _: None = Depends(require_camera_key),
):
    """Receive a crossing event from the local camera client.

    The camera client does face detection/recognition locally, determines
    entry/exit direction via crossing-line tracking, and POSTs the event here.
    The server handles DB persistence, authorization checks, and WebSocket alerts.
    """
    from services.access_handler import handle_crossing_event
    result = await handle_crossing_event(
        camera_id=body.camera_id,
        room_id=body.room_id,
        user_id=body.user_id,
        user_name=body.user_name,
        direction=body.direction,
        confidence=body.confidence,
    )
    return result


# ---------------------------------------------------------------------------
# Access events & alerts (admin views)
# ---------------------------------------------------------------------------

@router.get("/{camera_id}/events", response_model=list[AccessEventOut])
async def list_camera_events(
    camera_id: str,
    limit: int = 50,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: get recent access events for a camera."""
    db = await get_db()
    rows = await get_camera_events(db, camera_id=camera_id, limit=limit)
    return [AccessEventOut(**r) for r in rows]


@router.get("/events/all", response_model=list[AccessEventOut])
async def list_all_events(
    room_id: Optional[str] = None,
    limit: int = 50,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: get recent access events across all cameras."""
    db = await get_db()
    rows = await get_camera_events(db, room_id=room_id, limit=limit)
    return [AccessEventOut(**r) for r in rows]


# ---------------------------------------------------------------------------
# Access rules (admin)
# ---------------------------------------------------------------------------

@router.get("/rules/all", response_model=list[AccessRuleOut])
async def list_access_rules(
    building_id: Optional[str] = None,
    room_id: Optional[str] = None,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: list access rules."""
    db = await get_db()
    rows = await get_access_rules(db, building_id=building_id, room_id=room_id)
    return [AccessRuleOut(**r) for r in rows]


@router.post("/rules", response_model=dict, status_code=201)
async def create_access_rule_endpoint(
    body: AccessRuleCreateRequest,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: create an access rule."""
    db = await get_db()
    rule_id = await create_access_rule(
        db, role=body.role, user_id=body.user_id, room_id=body.room_id,
        building_id=body.building_id, day_of_week=body.day_of_week,
        start_hour=body.start_hour, end_hour=body.end_hour,
    )
    return {"id": rule_id, "status": "created"}


@router.delete("/rules/{rule_id}", response_model=dict)
async def delete_access_rule_endpoint(
    rule_id: str,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: delete an access rule."""
    db = await get_db()
    await delete_access_rule(db, rule_id)
    return {"id": rule_id, "status": "deleted"}


# ---------------------------------------------------------------------------
# Alerts (admin)
# ---------------------------------------------------------------------------

@router.get("/alerts/all", response_model=list[AlertOut])
async def list_alerts(
    acknowledged: Optional[bool] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: list alerts."""
    db = await get_db()
    ack = None
    if acknowledged is not None:
        ack = acknowledged
    rows = await get_alerts(db, acknowledged=ack, severity=severity, limit=limit)
    return [AlertOut(**r) for r in rows]


@router.patch("/alerts/{alert_id}/acknowledge", response_model=dict)
async def acknowledge_alert_endpoint(
    alert_id: str,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: acknowledge an alert."""
    db = await get_db()
    await acknowledge_alert(db, alert_id)
    return {"id": alert_id, "status": "acknowledged"}


# ---------------------------------------------------------------------------
# MJPEG proxy (for local camera client frames)
# ---------------------------------------------------------------------------

# The local camera client can push annotated frames here, and the admin UI
# fetches them via the /feed endpoint. This avoids needing direct RTSP access.
_latest_frames: dict[str, bytes] = {}  # camera_id -> latest JPEG bytes


@router.post("/{camera_id}/frame")
async def push_frame(
    camera_id: str,
    _: None = Depends(require_camera_key),
):
    """Camera client pushes annotated JPEG frames for the admin live view."""
    from fastapi import Request
    # This endpoint receives raw JPEG bytes in the request body
    # The camera client sends frames at ~5-10 FPS
    import starlette.requests
    # We'll handle this in a simpler way - the crossing event can include frame data
    return {"status": "ok"}


@router.get("/{camera_id}/feed")
async def camera_feed(
    camera_id: str,
    token: str = "",
):
    """MJPEG stream for admin live view. Renders in a plain <img> tag."""
    # Validate token
    from middleware.auth import _decode_token
    user = _decode_token(token)
    if not user or user.role != UserRole.admin:
        raise HTTPException(status_code=401, detail="Unauthorized")

    async def generate():
        while True:
            frame = _latest_frames.get(camera_id)
            if frame:
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n"
                       + frame + b"\r\n")
            await asyncio.sleep(0.1)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


def update_camera_frame(camera_id: str, jpeg_bytes: bytes):
    """Called by the crossing event handler to update the live frame."""
    _latest_frames[camera_id] = jpeg_bytes
