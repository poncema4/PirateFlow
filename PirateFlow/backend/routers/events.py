"""Campus events endpoints — scraped from SHU CampusLabs Engage."""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from services.events_scraper import (
    get_upcoming_events, get_events_for_date, get_events_at_location,
    get_events_for_building, scrape_all_events, create_bookings_from_events,
)
from middleware.auth import UserPayload, require_role
from models.schemas import UserRole

router = APIRouter(prefix="/api/events", tags=["events"])


class EventOut(BaseModel):
    id: str
    external_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    starts_at: str
    ends_at: Optional[str] = None
    image_url: Optional[str] = None
    organization: Optional[str] = None
    category_names: Optional[str] = None
    building_id: Optional[str] = None
    room_id: Optional[str] = None
    booking_id: Optional[str] = None


@router.get("", response_model=list[EventOut])
async def list_events(
    limit: int = 20,
    location: Optional[str] = None,
    date: Optional[str] = None,
    building_id: Optional[str] = None,
):
    """Get upcoming campus events. Public — no auth required."""
    if date:
        rows = await get_events_for_date(date)
    elif building_id:
        rows = await get_events_for_building(building_id, limit=limit)
    elif location:
        rows = await get_events_at_location(location)
    else:
        rows = await get_upcoming_events(limit=limit)
    return [EventOut(**r) for r in rows]


@router.post("/refresh", response_model=dict)
async def refresh_events(
    admin: UserPayload = Depends(require_role(UserRole.admin)),
):
    """Admin: manually trigger full event scrape + booking creation."""
    stats = await scrape_all_events(scrape_past=False, max_pages=10)
    bookings = await create_bookings_from_events()
    return {
        "status": "scraped",
        "new_events": stats["added"],
        "skipped": stats["skipped"],
        "matched_to_buildings": stats["matched"],
        "bookings_created": bookings,
    }
