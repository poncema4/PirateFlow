"""Booking endpoints — create, list, detail, cancel."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import UserPayload, get_current_user, require_role
from models.schemas import (
    BookingCreateRequest,
    BookingOut,
    BookingStatus,
    BookingType,
    PaginatedResponse,
    UserRole,
)

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

# In-memory stub store
STUB_BOOKINGS: list[BookingOut] = [
    BookingOut(
        id="bk_001",
        room_id="rm_001",
        room_name="Room 204",
        building_name="Walsh Library",
        user_id="usr_001",
        user_name="Demo Student",
        title="CS 101 Study Group",
        start_time=datetime(2026, 3, 21, 10, 0, tzinfo=timezone.utc),
        end_time=datetime(2026, 3, 21, 12, 0, tzinfo=timezone.utc),
        status=BookingStatus.confirmed,
        booking_type=BookingType.internal_student,
        created_at=datetime(2026, 3, 20, 15, 0, tzinfo=timezone.utc),
    ),
]


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(body: BookingCreateRequest, user: UserPayload = Depends(get_current_user)):
    """Create a new booking."""
    # TODO: conflict detection, DB insert, WebSocket emit
    now = datetime.now(timezone.utc)

    if body.start_time <= now:
        raise HTTPException(status_code=422, detail="Start time must be in the future")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="End time must be after start time")

    booking = BookingOut(
        id=f"bk_{len(STUB_BOOKINGS) + 1:03d}",
        room_id=body.room_id,
        room_name="Stub Room",
        building_name="Stub Building",
        user_id=user.user_id,
        user_name=user.email,
        title=body.title,
        start_time=body.start_time,
        end_time=body.end_time,
        status=BookingStatus.confirmed,
        booking_type=body.booking_type,
        created_at=now,
    )
    STUB_BOOKINGS.append(booking)
    return booking


@router.get("", response_model=PaginatedResponse)
async def list_bookings(
    status: Optional[BookingStatus] = None,
    room_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    user: UserPayload = Depends(get_current_user),
):
    """Return bookings. Students see their own, admins see all."""
    filtered = STUB_BOOKINGS

    # Scope by role: students/staff see only their own bookings
    if user.role != UserRole.admin:
        filtered = [b for b in filtered if b.user_id == user.user_id]
    if status:
        filtered = [b for b in filtered if b.status == status]
    if room_id:
        filtered = [b for b in filtered if b.room_id == room_id]

    return PaginatedResponse(
        items=filtered,
        total=len(filtered),
        page=page,
        page_size=page_size,
    )


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(booking_id: str, user: UserPayload = Depends(get_current_user)):
    """Return booking detail. Owner or admin only."""
    booking = next((b for b in STUB_BOOKINGS if b.id == booking_id), None)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role != UserRole.admin and booking.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="You can only view your own bookings")
    return booking


@router.patch("/{booking_id}/cancel", response_model=BookingOut)
async def cancel_booking(booking_id: str, user: UserPayload = Depends(get_current_user)):
    """Cancel a booking (soft delete). Owner or admin only."""
    # TODO: WebSocket emit on cancel
    booking = next((b for b in STUB_BOOKINGS if b.id == booking_id), None)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user.role != UserRole.admin and booking.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own bookings")
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(status_code=409, detail="Only confirmed bookings can be cancelled")

    booking.status = BookingStatus.cancelled
    return booking
