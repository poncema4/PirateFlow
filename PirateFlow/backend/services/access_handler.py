"""
Access event handler — processes crossing events from the camera client.

When the local camera client detects someone crossing the doorway line,
it POSTs a crossing event to the server. This module:
1. Inserts the event into access_events
2. Checks authorization (bookings + access rules)
3. Updates room occupancy
4. Fires alerts for unauthorized access
5. Broadcasts via WebSocket
"""

import base64
from datetime import datetime, timezone
from typing import Optional

from services.database import get_db
from services.queries import (
    insert_access_event, check_access_rules,
    get_room_occupancy, update_room_occupancy,
    insert_alert,
)


async def handle_crossing_event(
    camera_id: str,
    room_id: str,
    user_id: Optional[str],
    user_name: Optional[str],
    direction: str,  # "entry" or "exit"
    confidence: Optional[float] = None,
    frame_jpeg_b64: Optional[str] = None,
) -> dict:
    """Process a crossing event from the camera client."""
    db = await get_db()

    # 1. Check authorization
    authorized = False
    if user_id:
        # Check bookings first
        from services.face_service import check_booking_validity
        has_booking = await check_booking_validity(user_id, room_id)

        if has_booking:
            authorized = True
        else:
            # Check access rules (role-based)
            cursor = await db.execute(
                "SELECT role FROM users WHERE id = ?", (user_id,)
            )
            user_row = await cursor.fetchone()
            if user_row:
                # Get building_id for the room
                cursor2 = await db.execute("""
                    SELECT b.id FROM buildings b
                    JOIN floors f ON f.building_id = b.id
                    JOIN rooms r ON r.floor_id = f.id
                    WHERE r.id = ?
                """, (room_id,))
                bld_row = await cursor2.fetchone()
                building_id = bld_row["id"] if bld_row else None

                authorized = await check_access_rules(
                    db, user_id, user_row["role"], room_id, building_id
                )

    # 2. Insert access event
    event_id = await insert_access_event(
        db, camera_id=camera_id, room_id=room_id,
        user_id=user_id, direction=direction,
        authorized=authorized, confidence=confidence,
    )

    # 3. Update room occupancy
    occ = await get_room_occupancy(db, room_id)
    if occ:
        current = occ["headcount"]
    else:
        current = 0

    if direction == "entry":
        new_count = current + 1
    else:
        new_count = max(0, current - 1)

    await update_room_occupancy(db, room_id, new_count)

    # 4. Fire alert if unauthorized
    alert_id = None
    if not authorized and direction == "entry":
        if user_id:
            desc = f"{user_name or user_id} entered without authorization"
        else:
            desc = "Unrecognized person entered"

        alert_id = await insert_alert(
            db, event_id=event_id, room_id=room_id,
            user_id=user_id, alert_type="unauthorized_access",
            severity="critical", description=desc,
        )

    # 5. Broadcast via WebSocket
    try:
        from routers.websocket import manager

        # Broadcast access event to admins
        await manager.broadcast_to_admins("access_event", {
            "event_id": event_id,
            "camera_id": camera_id,
            "room_id": room_id,
            "user_id": user_id,
            "user_name": user_name or "Unknown",
            "direction": direction,
            "authorized": authorized,
            "confidence": confidence,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Broadcast occupancy change to all
        await manager.broadcast("occupancy_changed", {
            "room_id": room_id,
            "headcount": new_count,
        })

        # Broadcast alert if unauthorized
        if alert_id:
            await manager.broadcast_to_admins("access_alert", {
                "alert_id": alert_id,
                "type": "unauthorized_access",
                "severity": "critical",
                "room_id": room_id,
                "user_name": user_name or "Unknown",
                "description": f"{'Unrecognized person' if not user_id else user_name or user_id} detected entering room without authorization",
                "detected_at": datetime.now(timezone.utc).isoformat(),
            })
    except Exception as e:
        print(f"[access_handler] WebSocket broadcast failed: {e}")

    # 6. Update live frame if provided
    if frame_jpeg_b64:
        try:
            from routers.cameras import update_camera_frame
            frame_bytes = base64.b64decode(frame_jpeg_b64)
            update_camera_frame(camera_id, frame_bytes)
        except Exception:
            pass

    return {
        "event_id": event_id,
        "direction": direction,
        "authorized": authorized,
        "alert_sent": alert_id is not None,
        "occupancy": new_count,
    }
