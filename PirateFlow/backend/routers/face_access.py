"""Face recognition access control endpoints.

Handles face registration, verification (camera scan), and access logging.
The verify endpoint is called by camera clients to check if a person
entering a room is authorized (has a valid booking).
"""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import UserPayload, get_current_user, require_camera_key, require_role
from models.schemas import (
    AccessLogEntry,
    FaceRegisterRequest,
    FaceRegisterResponse,
    FaceVerifyRequest,
    FaceVerifyResponse,
    UserRole,
)
from services import face_service

router = APIRouter(prefix="/api/face", tags=["face-access"])


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

@router.post("/register", response_model=FaceRegisterResponse)
async def register_own_face(
    body: FaceRegisterRequest,
    user: UserPayload = Depends(get_current_user),
):
    """Register or update the calling user's face encoding."""
    image_bytes = face_service.decode_image(body.image_base64)
    success = await face_service.register_face(
        user_id=user.user_id,
        image_bytes=image_bytes,
        user_name=f"{user.email}",
    )
    if not success:
        raise HTTPException(status_code=400, detail="No face detected in the image. Please try a clearer photo.")

    status_text = "registered"
    return FaceRegisterResponse(
        user_id=user.user_id,
        status=status_text,
        message=f"Face {status_text} successfully for {user.email}.",
    )


@router.post("/register/{user_id}", response_model=FaceRegisterResponse)
async def register_user_face(
    user_id: str,
    body: FaceRegisterRequest,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: register or update face encoding for any user."""
    image_bytes = face_service.decode_image(body.image_base64)
    success = await face_service.register_face(
        user_id=user_id,
        image_bytes=image_bytes,
        user_name=user_id,
    )
    if not success:
        raise HTTPException(status_code=400, detail="No face detected in the image.")

    return FaceRegisterResponse(
        user_id=user_id,
        status="registered",
        message=f"Face registered for user {user_id}.",
    )


@router.delete("/register/{user_id}")
async def remove_user_face(
    user_id: str,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: remove a user's face encoding."""
    removed = face_service.remove_face(user_id)
    if not removed:
        raise HTTPException(status_code=404, detail="No face encoding found for this user.")
    return {"status": "removed", "user_id": user_id}


# ---------------------------------------------------------------------------
# Verification (called by cameras)
# ---------------------------------------------------------------------------

@router.post("/verify", response_model=FaceVerifyResponse)
async def verify_face(
    body: FaceVerifyRequest,
    _: None = Depends(require_camera_key),
):
    """
    Camera sends a frame — backend identifies the face and checks booking.

    If the person is not recognized or doesn't have a valid booking,
    an alert is broadcast to all admin WebSocket connections.
    """
    image_bytes = face_service.decode_image(body.image_base64)

    # Try to identify the face
    match = await face_service.identify_face(image_bytes)

    # Room name lookup (stub — will use DB later)
    room_name = f"Room {body.room_id}"
    building_name = "Campus"

    if match is None:
        # Face not recognized at all
        alert_sent = await _send_access_alert(
            room_id=body.room_id,
            room_name=room_name,
            building_name=building_name,
            user_name=None,
            description=f"Unrecognized person detected entering {room_name}.",
        )
        log_entry = face_service.log_access(
            room_id=body.room_id,
            room_name=room_name,
            user_id=None,
            user_name=None,
            confidence=None,
            had_valid_booking=False,
            alert_sent=alert_sent,
        )
        # Fire-and-forget: Claude Vision analyzes the frame for deeper context
        _launch_vision_analysis(body.image_base64, body.room_id, room_name, building_name, None, log_entry.id)
        return FaceVerifyResponse(recognized=False, alert_sent=alert_sent)

    user_id, confidence = match
    user_name = face_service.get_user_name(user_id) or user_id

    # Check if they have a valid booking for this room right now
    has_booking = face_service.check_booking_validity(user_id, body.room_id)

    alert_sent = False
    if not has_booking:
        alert_sent = await _send_access_alert(
            room_id=body.room_id,
            room_name=room_name,
            building_name=building_name,
            user_name=user_name,
            description=f"{user_name} detected in {room_name} without a valid booking.",
        )

    log_entry = face_service.log_access(
        room_id=body.room_id,
        room_name=room_name,
        user_id=user_id,
        user_name=user_name,
        confidence=confidence,
        had_valid_booking=has_booking,
        alert_sent=alert_sent,
    )

    # Fire-and-forget: Claude Vision analyzes unauthorized access
    if not has_booking:
        _launch_vision_analysis(body.image_base64, body.room_id, room_name, building_name, user_name, log_entry.id)

    return FaceVerifyResponse(
        recognized=True,
        user_id=user_id,
        user_name=user_name,
        has_valid_booking=has_booking,
        confidence=confidence,
        alert_sent=alert_sent,
    )


def _launch_vision_analysis(
    image_base64: str,
    room_id: str,
    room_name: str,
    building_name: str,
    detected_user: str | None,
    access_log_id: str,
):
    """
    Launch Claude Vision analysis as a fire-and-forget background task.
    Does not block the verify response — the real-time alert has already fired.
    The analysis result arrives later as an 'access_analysis' WebSocket event.
    """
    from services.vision_analysis import analyze_and_broadcast

    asyncio.create_task(analyze_and_broadcast(
        image_base64=image_base64,
        room_id=room_id,
        room_name=room_name,
        building_name=building_name,
        detected_user=detected_user,
        access_log_id=access_log_id,
    ))


async def _send_access_alert(
    room_id: str,
    room_name: str,
    building_name: str,
    user_name: str | None,
    description: str,
) -> bool:
    """Broadcast an unauthorized access alert to admin dashboards."""
    from routers.websocket import manager

    await manager.broadcast_to_admins("access_alert", {
        "type": "unauthorized_access",
        "severity": "critical",
        "room_id": room_id,
        "room_name": room_name,
        "building_name": building_name,
        "description": description,
        "detected_user": user_name or "Unknown",
        "detected_at": datetime.now(timezone.utc).isoformat(),
    })
    return True


# ---------------------------------------------------------------------------
# Access log & status (admin only)
# ---------------------------------------------------------------------------

@router.get("/access-log", response_model=list[AccessLogEntry])
async def get_access_log(
    limit: int = 50,
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: view recent access scan attempts."""
    return face_service.get_access_log(limit=limit)


@router.get("/status")
async def face_status(
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: face recognition system status."""
    log = face_service.get_access_log(limit=10)
    recent_alerts = sum(1 for entry in log if entry.alert_sent)
    return {
        "registered_faces": face_service.get_registered_count(),
        "recent_scans": len(log),
        "recent_alerts": recent_alerts,
    }
