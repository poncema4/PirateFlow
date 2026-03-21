"""Room endpoints — list, detail, filter, availability."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from middleware.auth import get_current_user
from models.schemas import (
    BookingOut, BookingStatus, BookingType,
    PaginatedResponse, RoomOut, RoomStatus, RoomSummaryOut, RoomType, TimeSlot,
)
from services.database import get_db
from services.queries import get_rooms_filtered, get_room_by_id, get_room_availability

router = APIRouter(prefix="/api/rooms", tags=["rooms"], dependencies=[Depends(get_current_user)])


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
    db = await get_db()
    result = await get_rooms_filtered(
        db, building_id=building_id, floor_id=floor_id,
        room_type=room_type.value if room_type else None,
        min_capacity=min_capacity, equipment=equipment,
        page=page, page_size=page_size,
    )

    items = [
        RoomSummaryOut(
            id=r["id"], name=r["name"], room_type=RoomType(r["room_type"]),
            capacity=r["capacity"], status=RoomStatus(r["status"]),
            building_name=r["building_name"], floor_name=r["floor_name"],
            hourly_rate=r["hourly_rate"], equipment=r["equipment"],
        )
        for r in result["items"]
    ]

    return PaginatedResponse(
        items=items, total=result["total"],
        page=result["page"], page_size=result["page_size"],
    )


@router.get("/{room_id}", response_model=RoomOut)
async def get_room(room_id: str):
    """Return full room detail."""
    db = await get_db()
    result = await get_room_by_id(db, room_id)
    if not result:
        raise HTTPException(status_code=404, detail="Room not found")

    room = result["room"]
    bookings_out = []
    for bk in result["upcoming_bookings"]:
        bookings_out.append(BookingOut(
            id=bk["id"], room_id=bk["room_id"], room_name=room["name"],
            building_name=room["building_name"], user_id=bk["user_id"],
            user_name=bk["user_name"], title=bk["title"],
            start_time=bk["start_time"], end_time=bk["end_time"],
            status=BookingStatus(bk["status"]),
            booking_type=BookingType(bk["booking_type"]),
            created_at=bk["created_at"],
        ))

    return RoomOut(
        id=room["id"], name=room["name"],
        room_type=RoomType(room["room_type"]),
        capacity=room["capacity"], status=RoomStatus(room["status"]),
        description=room["description"], hourly_rate=room["hourly_rate"],
        is_bookable=bool(room["is_bookable"]),
        building_id=room["building_id"], building_name=room["building_name"],
        floor_id=room["floor_id"], floor_name=room["floor_name"],
        equipment=result["equipment"],
        upcoming_bookings=bookings_out,
    )


@router.get("/{room_id}/availability", response_model=list[TimeSlot])
async def room_availability(room_id: str, date: str = "2026-03-21"):
    """Return time slots for a given date showing booked vs free."""
    db = await get_db()
    slots = await get_room_availability(db, room_id, date)
    return [TimeSlot(**s) for s in slots]
