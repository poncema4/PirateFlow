"""Room endpoints — list, detail, filter, availability."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from middleware.auth import get_current_user
from models.schemas import (
    PaginatedResponse,
    RoomOut,
    RoomStatus,
    RoomSummaryOut,
    RoomType,
    TimeSlot,
)

router = APIRouter(prefix="/api/rooms", tags=["rooms"], dependencies=[Depends(get_current_user)])

# Stub rooms
STUB_ROOMS = [
    RoomSummaryOut(id="rm_001", name="Room 204", room_type=RoomType.study_room, capacity=6, status=RoomStatus.available, building_name="Walsh Library", floor_name="Floor 2", hourly_rate=None, equipment=["whiteboard", "power_outlets"]),
    RoomSummaryOut(id="rm_002", name="Computer Lab A", room_type=RoomType.computer_lab, capacity=30, status=RoomStatus.occupied, building_name="Walsh Library", floor_name="Floor 3", hourly_rate=25.0, equipment=["projector", "whiteboard", "computers"]),
    RoomSummaryOut(id="rm_003", name="Lecture Hall 101", room_type=RoomType.lecture_hall, capacity=150, status=RoomStatus.available, building_name="Corrigan Hall", floor_name="Floor 1", hourly_rate=75.0, equipment=["projector", "smart_board", "video_conferencing"]),
    RoomSummaryOut(id="rm_004", name="Science Lab B", room_type=RoomType.science_lab, capacity=20, status=RoomStatus.available, building_name="McNulty Hall", floor_name="Floor 2", hourly_rate=40.0, equipment=["lab_equipment", "whiteboard"]),
    RoomSummaryOut(id="rm_005", name="Conference Room 3A", room_type=RoomType.conference_room, capacity=12, status=RoomStatus.available, building_name="Stafford Place", floor_name="Floor 3", hourly_rate=35.0, equipment=["projector", "video_conferencing", "whiteboard"]),
    RoomSummaryOut(id="rm_006", name="Grand Hall", room_type=RoomType.event_space, capacity=250, status=RoomStatus.available, building_name="University Center", floor_name="Floor 1", hourly_rate=150.0, equipment=["projector", "smart_board", "video_conferencing", "recording_studio"]),
]


@router.get("", response_model=PaginatedResponse)
async def list_rooms(
    building_id: Optional[str] = None,
    floor_id: Optional[str] = None,
    room_type: Optional[RoomType] = None,
    min_capacity: Optional[int] = None,
    equipment: Optional[list[str]] = Query(None),
    page: int = 1,
    page_size: int = 20,
):
    """Return rooms with filtering and pagination."""
    # TODO: replace with DB query + filters
    filtered = STUB_ROOMS
    if room_type:
        filtered = [r for r in filtered if r.room_type == room_type]
    if min_capacity:
        filtered = [r for r in filtered if r.capacity >= min_capacity]

    return PaginatedResponse(
        items=filtered,
        total=len(filtered),
        page=page,
        page_size=page_size,
    )


@router.get("/{room_id}", response_model=RoomOut)
async def get_room(room_id: str):
    """Return full room detail."""
    # TODO: replace with DB query
    stub = next((r for r in STUB_ROOMS if r.id == room_id), None)
    if not stub:
        raise HTTPException(status_code=404, detail="Room not found")

    return RoomOut(
        id=stub.id,
        name=stub.name,
        room_type=stub.room_type,
        capacity=stub.capacity,
        status=stub.status,
        description=f"A {stub.room_type.value.replace('_', ' ')} in {stub.building_name}.",
        hourly_rate=stub.hourly_rate,
        is_bookable=True,
        building_id="bld_004",
        building_name=stub.building_name,
        floor_id="flr_001",
        floor_name=stub.floor_name,
        equipment=stub.equipment,
        upcoming_bookings=[],
    )


@router.get("/{room_id}/availability", response_model=list[TimeSlot])
async def get_room_availability(room_id: str, date: str = "2026-03-21"):
    """Return time slots for a given date showing booked vs free."""
    # TODO: replace with DB query
    slots = []
    for hour in range(8, 22):
        # Stub: mark some hours as booked
        is_booked = hour in (10, 11, 14, 15)
        slots.append(TimeSlot(
            start_time=f"{hour:02d}:00",
            end_time=f"{hour + 1:02d}:00",
            status="booked" if is_booked else "available",
            booking_id="bk_stub" if is_booked else None,
        ))
    return slots
