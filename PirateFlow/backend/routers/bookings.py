"""Booking endpoints — create, list, detail, cancel."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from middleware.auth import UserPayload, get_current_user
from models.schemas import (
    BookingCreateRequest, BookingOut, BookingStatus, BookingType,
    PaginatedResponse, UserRole,
)
from services.database import get_db
from services.queries import (
    create_booking, check_booking_conflict,
    get_bookings_filtered, get_booking_by_id, cancel_booking,
)

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking_endpoint(body: BookingCreateRequest, user: UserPayload = Depends(get_current_user)):
    """Create a new booking."""
    now = datetime.now(timezone.utc)

    if body.start_time <= now:
        raise HTTPException(status_code=422, detail="Start time must be in the future")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="End time must be after start time")

    db = await get_db()

    # Check room exists
    cursor = await db.execute("SELECT id FROM rooms WHERE id = ?", (body.room_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Room not found")

    # Check for conflicts
    has_conflict = await check_booking_conflict(db, body.room_id, body.start_time, body.end_time)
    if has_conflict:
        raise HTTPException(status_code=409, detail="Room already booked for this time slot")

    booking_id = await create_booking(
        db, body.room_id, user.user_id, body.title,
        body.start_time, body.end_time, body.booking_type.value,
    )

    row = await get_booking_by_id(db, booking_id)
    return BookingOut(
        id=row["id"], room_id=row["room_id"], room_name=row["room_name"],
        building_name=row["building_name"], user_id=row["user_id"],
        user_name=row["user_name"], title=row["title"],
        start_time=row["start_time"], end_time=row["end_time"],
        status=BookingStatus(row["status"]),
        booking_type=BookingType(row["booking_type"]),
        created_at=row["created_at"],
    )


@router.get("", response_model=PaginatedResponse)
async def list_bookings(
    status: Optional[BookingStatus] = None,
    room_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    user: UserPayload = Depends(get_current_user),
):
    """Return bookings. Students see their own, admins see all."""
    db = await get_db()
    result = await get_bookings_filtered(
        db, user_id=user.user_id, role=user.role.value,
        status=status.value if status else None,
        room_id=room_id, page=page, page_size=page_size,
    )

    items = []
    for row in result["items"]:
        items.append(BookingOut(
            id=row["id"], room_id=row["room_id"], room_name=row["room_name"],
            building_name=row["building_name"], user_id=row["user_id"],
            user_name=row["user_name"], title=row["title"],
            start_time=row["start_time"], end_time=row["end_time"],
            status=BookingStatus(row["status"]),
            booking_type=BookingType(row["booking_type"]),
            created_at=row["created_at"],
        ))

    return PaginatedResponse(
        items=items, total=result["total"],
        page=result["page"], page_size=result["page_size"],
    )


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking_endpoint(booking_id: str, user: UserPayload = Depends(get_current_user)):
    """Return booking detail. Owner or admin only."""
    db = await get_db()
    row = await get_booking_by_id(db, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role != UserRole.admin and row["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="You can only view your own bookings")

    return BookingOut(
        id=row["id"], room_id=row["room_id"], room_name=row["room_name"],
        building_name=row["building_name"], user_id=row["user_id"],
        user_name=row["user_name"], title=row["title"],
        start_time=row["start_time"], end_time=row["end_time"],
        status=BookingStatus(row["status"]),
        booking_type=BookingType(row["booking_type"]),
        created_at=row["created_at"],
    )


@router.patch("/{booking_id}/cancel", response_model=BookingOut)
async def cancel_booking_endpoint(booking_id: str, user: UserPayload = Depends(get_current_user)):
    """Cancel a booking (soft delete). Owner or admin only."""
    db = await get_db()
    row = await get_booking_by_id(db, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role != UserRole.admin and row["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own bookings")
    if row["status"] != "confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed bookings can be cancelled")

    await cancel_booking(db, booking_id)
    updated = await get_booking_by_id(db, booking_id)

    return BookingOut(
        id=updated["id"], room_id=updated["room_id"], room_name=updated["room_name"],
        building_name=updated["building_name"], user_id=updated["user_id"],
        user_name=updated["user_name"], title=updated["title"],
        start_time=updated["start_time"], end_time=updated["end_time"],
        status=BookingStatus(updated["status"]),
        booking_type=BookingType(updated["booking_type"]),
        created_at=updated["created_at"],
    )
