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

router = APIRouter(prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(require_role(UserRole.admin))])


# ---------------------------------------------------------------------------
# Utilization
# ---------------------------------------------------------------------------

@router.get("/utilization", response_model=list[UtilizationDataPoint])
async def get_utilization(
    building_id: Optional[str] = None,
    room_type: Optional[str] = None,
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
    granularity: str = "daily",
):
    """Return utilization time series."""
    # TODO: wire to Role 1's analytics queries
    return [
        UtilizationDataPoint(period="2026-03-15", utilization_pct=0.65),
        UtilizationDataPoint(period="2026-03-16", utilization_pct=0.58),
        UtilizationDataPoint(period="2026-03-17", utilization_pct=0.72),
        UtilizationDataPoint(period="2026-03-18", utilization_pct=0.81),
        UtilizationDataPoint(period="2026-03-19", utilization_pct=0.69),
        UtilizationDataPoint(period="2026-03-20", utilization_pct=0.43),
        UtilizationDataPoint(period="2026-03-21", utilization_pct=0.15),
    ]


@router.get("/utilization/heatmap", response_model=list[HeatmapCell])
async def get_utilization_heatmap(
    building_id: Optional[str] = None,
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
):
    """Return heatmap data (day_of_week x hour -> utilization %)."""
    # TODO: wire to Role 1's analytics queries
    cells = []
    import random
    random.seed(42)
    for day in range(7):
        for hour in range(8, 22):
            base = 0.7 if day < 4 else (0.4 if day == 4 else 0.15)
            peak_bonus = 0.2 if 9 <= hour <= 15 else 0.0
            val = min(1.0, max(0.0, base + peak_bonus + random.uniform(-0.15, 0.15)))
            cells.append(HeatmapCell(day=day, hour=hour, value=round(val, 2)))
    return cells


@router.get("/peak-hours", response_model=list[PeakHourData])
async def get_peak_hours(
    building_id: Optional[str] = None,
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
):
    """Return busiest hours across campus."""
    # TODO: wire to Role 1's analytics queries
    return [
        PeakHourData(hour=h, avg_utilization=v)
        for h, v in [
            (8, 0.35), (9, 0.62), (10, 0.78), (11, 0.82),
            (12, 0.55), (13, 0.71), (14, 0.76), (15, 0.68),
            (16, 0.52), (17, 0.38), (18, 0.30), (19, 0.25),
            (20, 0.18), (21, 0.10),
        ]
    ]


@router.get("/by-department", response_model=list[DepartmentUsage])
async def get_usage_by_department(
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
):
    """Return space usage grouped by department."""
    # TODO: wire to Role 1's analytics queries
    return [
        DepartmentUsage(department="Computer Science", total_hours=1250, total_bookings=420),
        DepartmentUsage(department="Biology", total_hours=980, total_bookings=340),
        DepartmentUsage(department="Business", total_hours=870, total_bookings=290),
        DepartmentUsage(department="English", total_hours=650, total_bookings=215),
        DepartmentUsage(department="Student Affairs", total_hours=520, total_bookings=180),
    ]


# ---------------------------------------------------------------------------
# Revenue
# ---------------------------------------------------------------------------

@router.get("/revenue", response_model=RevenueSummary)
async def get_revenue(
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
    building_id: Optional[str] = None,
):
    """Return revenue summary."""
    # TODO: wire to Role 1's analytics queries
    return RevenueSummary(
        total=47230.0,
        external_rental=32100.0,
        chargebacks=15130.0,
        by_building=[
            {"building_name": "University Center", "amount": 18500},
            {"building_name": "Walsh Library", "amount": 9200},
            {"building_name": "Corrigan Hall", "amount": 7800},
            {"building_name": "McNulty Hall", "amount": 5430},
            {"building_name": "Stafford Place", "amount": 3800},
            {"building_name": "Jubilee Hall", "amount": 2500},
        ],
        by_room_type=[
            {"room_type": "event_space", "amount": 19800},
            {"room_type": "conference_room", "amount": 11200},
            {"room_type": "lecture_hall", "amount": 7500},
            {"room_type": "computer_lab", "amount": 5230},
            {"room_type": "classroom", "amount": 3500},
        ],
        over_time=[
            {"period": "2025-10", "amount": 8200},
            {"period": "2025-11", "amount": 9100},
            {"period": "2025-12", "amount": 6800},
            {"period": "2026-01", "amount": 7900},
            {"period": "2026-02", "amount": 8430},
            {"period": "2026-03", "amount": 6800},
        ],
    )


@router.get("/revenue/opportunity", response_model=dict)
async def get_revenue_opportunity(
    start_date: str = "2026-01-01",
    end_date: str = "2026-03-21",
):
    """Return untapped revenue potential from underutilized spaces."""
    # TODO: wire to Role 1's analytics queries
    opportunities = [
        RevenueOpportunity(room_id="rm_010", room_name="Seminar Room 2B", building_name="Stafford Place", room_type=RoomType.conference_room, current_utilization_pct=0.12, available_hours_per_week=35, hourly_rate=35.0, estimated_weekly_revenue=1077.0),
        RevenueOpportunity(room_id="rm_011", room_name="Classroom 305", building_name="Jubilee Hall", room_type=RoomType.classroom, current_utilization_pct=0.18, available_hours_per_week=30, hourly_rate=20.0, estimated_weekly_revenue=492.0),
        RevenueOpportunity(room_id="rm_012", room_name="Multipurpose B", building_name="University Center", room_type=RoomType.multipurpose, current_utilization_pct=0.15, available_hours_per_week=40, hourly_rate=50.0, estimated_weekly_revenue=1700.0),
    ]

    total_weekly = sum(o.estimated_weekly_revenue for o in opportunities)
    total_semester = total_weekly * 16

    return {
        "estimated_untapped_weekly": total_weekly,
        "estimated_untapped_semester": total_semester,
        "underutilized_spaces": opportunities,
    }
