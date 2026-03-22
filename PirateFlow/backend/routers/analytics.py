"""Analytics endpoints — all admin-only."""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends

from middleware.auth import require_role
from models.schemas import UserRole
from models.schemas import (
    AnalyticsSummary,
    BookingTypeBreakdown,
    DepartmentUsage,
    HeatmapCell,
    PeakHourData,
    RoomTypePopularity,
    TopRoom,
    UtilizationDataPoint,
)
from services.database import get_db
from services.queries import (
    get_utilization, get_utilization_heatmap, get_peak_hours,
    get_usage_by_department, get_analytics_summary,
    get_room_type_popularity, get_top_rooms, get_booking_type_breakdown,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(require_role(UserRole.admin))])


def _resolve_dates(time_range=None, start_date=None, end_date=None):
    """Convert time_range (7d/30d/semester) to start/end date strings."""
    today = date.today()
    if time_range == "7d":
        return (today - timedelta(days=7)).isoformat(), today.isoformat()
    elif time_range == "30d":
        return (today - timedelta(days=30)).isoformat(), today.isoformat()
    elif time_range == "semester":
        return "2026-01-12", today.isoformat()
    return start_date or "2026-01-01", end_date or today.isoformat()


# ---------------------------------------------------------------------------
# Utilization
# ---------------------------------------------------------------------------

@router.get("/utilization", response_model=list[UtilizationDataPoint])
async def utilization_endpoint(
    building_id: Optional[str] = None,
    room_type: Optional[str] = None,
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    granularity: str = "daily",
):
    """Return utilization time series."""
    sd, ed = _resolve_dates(time_range, start_date, end_date)
    db = await get_db()
    rows = await get_utilization(db, building_id, room_type, sd, ed, granularity)
    return [UtilizationDataPoint(**r) for r in rows]


@router.get("/utilization/heatmap", response_model=list[HeatmapCell])
async def heatmap_endpoint(
    building_id: Optional[str] = None,
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Return heatmap data (day_of_week x hour -> utilization %)."""
    sd, ed = _resolve_dates(time_range, start_date, end_date)
    db = await get_db()
    cells = await get_utilization_heatmap(db, building_id, sd, ed)
    return [HeatmapCell(**c) for c in cells]


@router.get("/peak-hours", response_model=list[PeakHourData])
async def peak_hours_endpoint(
    building_id: Optional[str] = None,
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Return busiest hours across campus."""
    sd, ed = _resolve_dates(time_range, start_date, end_date)
    db = await get_db()
    rows = await get_peak_hours(db, building_id, sd, ed)
    return [PeakHourData(**r) for r in rows]


@router.get("/by-department", response_model=list[DepartmentUsage])
async def department_usage_endpoint(
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Return space usage grouped by department."""
    sd, ed = _resolve_dates(time_range, start_date, end_date)
    db = await get_db()
    rows = await get_usage_by_department(db, sd, ed)
    return [DepartmentUsage(**r) for r in rows]


# ---------------------------------------------------------------------------
# New Analytics
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=AnalyticsSummary)
async def summary_endpoint(
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Return high-level summary stats."""
    sd, ed = _resolve_dates(time_range, start_date, end_date)
    db = await get_db()
    return AnalyticsSummary(**(await get_analytics_summary(db, sd, ed)))


@router.get("/room-types", response_model=list[RoomTypePopularity])
async def room_type_popularity_endpoint(
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Return booking counts by room type."""
    sd, ed = _resolve_dates(time_range, start_date, end_date)
    db = await get_db()
    rows = await get_room_type_popularity(db, sd, ed)
    return [RoomTypePopularity(**r) for r in rows]


@router.get("/top-rooms", response_model=list[TopRoom])
async def top_rooms_endpoint(
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 10,
):
    """Return the most booked rooms."""
    sd, ed = _resolve_dates(time_range, start_date, end_date)
    db = await get_db()
    rows = await get_top_rooms(db, sd, ed, limit)
    return [TopRoom(**r) for r in rows]


@router.get("/booking-types", response_model=list[BookingTypeBreakdown])
async def booking_types_endpoint(
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Return booking counts by booking type."""
    sd, ed = _resolve_dates(time_range, start_date, end_date)
    db = await get_db()
    rows = await get_booking_type_breakdown(db, sd, ed)
    return [BookingTypeBreakdown(**r) for r in rows]
