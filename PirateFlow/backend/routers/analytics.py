"""Analytics and revenue endpoints — all admin-only."""

from typing import Optional

from fastapi import APIRouter, Depends

from middleware.auth import require_role
from models.schemas import UserRole
from models.schemas import (
    DepartmentUsage,
    HeatmapCell,
    PeakHourData,
    RevenueOpportunity,
    RevenueSummary,
    RoomType,
    UtilizationDataPoint,
)
from services.database import get_db
from services.queries import (
    get_utilization, get_utilization_heatmap, get_peak_hours,
    get_usage_by_department, get_revenue_summary, get_revenue_opportunity,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(require_role(UserRole.admin))])


# ---------------------------------------------------------------------------
# Utilization
# ---------------------------------------------------------------------------

@router.get("/utilization", response_model=list[UtilizationDataPoint])
async def utilization_endpoint(
    building_id: Optional[str] = None,
    room_type: Optional[str] = None,
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
    granularity: str = "daily",
):
    """Return utilization time series."""
    db = await get_db()
    rows = await get_utilization(db, building_id, room_type, start_date, end_date, granularity)
    return [UtilizationDataPoint(**r) for r in rows]


@router.get("/utilization/heatmap", response_model=list[HeatmapCell])
async def heatmap_endpoint(
    building_id: Optional[str] = None,
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
):
    """Return heatmap data (day_of_week x hour -> utilization %)."""
    db = await get_db()
    cells = await get_utilization_heatmap(db, building_id, start_date, end_date)
    return [HeatmapCell(**c) for c in cells]


@router.get("/peak-hours", response_model=list[PeakHourData])
async def peak_hours_endpoint(
    building_id: Optional[str] = None,
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
):
    """Return busiest hours across campus."""
    db = await get_db()
    rows = await get_peak_hours(db, building_id, start_date, end_date)
    return [PeakHourData(**r) for r in rows]


@router.get("/by-department", response_model=list[DepartmentUsage])
async def department_usage_endpoint(
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
):
    """Return space usage grouped by department."""
    db = await get_db()
    rows = await get_usage_by_department(db, start_date, end_date)
    return [DepartmentUsage(**r) for r in rows]


# ---------------------------------------------------------------------------
# Revenue
# ---------------------------------------------------------------------------

@router.get("/revenue", response_model=RevenueSummary)
async def revenue_endpoint(
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
    building_id: Optional[str] = None,
):
    """Return revenue summary."""
    db = await get_db()
    result = await get_revenue_summary(db, start_date, end_date, building_id)
    return RevenueSummary(**result)


@router.get("/revenue/opportunity", response_model=dict)
async def revenue_opportunity_endpoint(
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
):
    """Return untapped revenue potential from underutilized spaces."""
    db = await get_db()
    return await get_revenue_opportunity(db, start_date, end_date)
