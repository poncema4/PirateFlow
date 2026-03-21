"""Demo mode endpoints — simulate real-time campus activity."""

import asyncio
import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from middleware.auth import require_role
from models.schemas import UserRole

router = APIRouter(prefix="/api/demo", tags=["demo"], dependencies=[Depends(require_role(UserRole.admin))])

# Track demo mode state
_demo_task: asyncio.Task | None = None
_demo_running = False


async def _run_demo_simulation():
    """Background task that simulates occupancy changes every 3-5 seconds."""
    global _demo_running
    from routers.websocket import manager

    buildings = ["Jubilee Hall", "McNulty Hall", "Corrigan Hall", "Walsh Library", "University Center", "Stafford Place"]
    room_names = ["Room 101", "Room 204", "Lab A", "Study Room 3", "Conference 2B", "Lecture Hall 1"]

    while _demo_running:
        # Simulate an occupancy change
        building = random.choice(buildings)
        room = random.choice(room_names)
        is_occupied = random.choice([True, False])

        await manager.broadcast_all("occupancy_changed", {
            "room_name": f"{room}",
            "building_name": building,
            "is_occupied": is_occupied,
        })

        # Occasionally simulate a new booking
        if random.random() < 0.3:
            await manager.broadcast_to_admins("booking_created", {
                "room_name": room,
                "building_name": building,
                "user_name": random.choice(["Alice Johnson", "Bob Smith", "Carol Davis", "Dan Lee"]),
                "start_time": "14:00",
                "end_time": "16:00",
            })

        # Occasionally simulate an anomaly alert
        if random.random() < 0.05:
            await manager.broadcast_to_admins("anomaly_alert", {
                "type": "ghost_booking",
                "severity": "warning",
                "description": f"No-show detected for {room} in {building}",
            })

        # Occasionally simulate an unauthorized access alert
        if random.random() < 0.08:
            detected = random.choice(["Unknown", "Bob Smith", "Jane Doe"])
            await manager.broadcast_to_admins("access_alert", {
                "type": "unauthorized_access",
                "severity": "critical",
                "room_name": room,
                "building_name": building,
                "description": f"{'Unrecognized person' if detected == 'Unknown' else detected} detected in {room}, {building} without a valid booking.",
                "detected_user": detected,
                "detected_at": datetime.now(timezone.utc).isoformat(),
            })

        await asyncio.sleep(random.uniform(3, 5))


@router.post("/start")
async def start_demo():
    """Start demo mode — simulates real-time activity."""
    global _demo_task, _demo_running

    if _demo_running:
        return {"status": "already_running"}

    _demo_running = True
    _demo_task = asyncio.create_task(_run_demo_simulation())
    return {"status": "started"}


@router.post("/stop")
async def stop_demo():
    """Stop demo mode."""
    global _demo_task, _demo_running

    if not _demo_running:
        return {"status": "not_running"}

    _demo_running = False
    if _demo_task:
        _demo_task.cancel()
        _demo_task = None
    return {"status": "stopped"}


@router.get("/status")
async def demo_status():
    """Check if demo mode is active."""
    return {"running": _demo_running}
