"""
Pydantic models — shared contract between backend and frontend.

These define request/response shapes for every endpoint.
Role 1 (Data & Auth) may adjust field names once the DB schema is final,
but the structure and types here are the API contract the frontend builds against.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RoomType(str, Enum):
    classroom = "classroom"
    lecture_hall = "lecture_hall"
    computer_lab = "computer_lab"
    science_lab = "science_lab"
    study_room = "study_room"
    conference_room = "conference_room"
    event_space = "event_space"
    multipurpose = "multipurpose"


class RoomStatus(str, Enum):
    available = "available"
    occupied = "occupied"
    maintenance = "maintenance"
    closed = "closed"


class BookingStatus(str, Enum):
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"
    no_show = "no_show"


class BookingType(str, Enum):
    internal_student = "internal_student"
    internal_staff = "internal_staff"
    internal_department = "internal_department"
    external = "external"


class UserRole(str, Enum):
    admin = "admin"
    staff = "staff"
    student = "student"


class AnomalyType(str, Enum):
    ghost_booking = "ghost_booking"
    phantom_usage = "phantom_usage"
    utilization_spike = "utilization_spike"
    space_hoarding = "space_hoarding"
    unusual_pattern = "unusual_pattern"


class Severity(str, Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    department: Optional[str] = None
    major: Optional[str] = None
    year: Optional[str] = None
    student_id: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------------------
# Buildings & Floors
# ---------------------------------------------------------------------------

class BuildingOut(BaseModel):
    id: str
    name: str
    code: str
    address: Optional[str] = None
    total_floors: int
    room_count: int
    current_occupancy_pct: float = 0.0


class FloorOut(BaseModel):
    id: str
    building_id: str
    floor_number: int
    name: str
    room_count: int = 0


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------

class RoomSummaryOut(BaseModel):
    id: str
    name: str
    room_type: RoomType
    capacity: int
    status: RoomStatus
    building_name: str
    floor_name: str
    hourly_rate: Optional[float] = None
    equipment: list[str] = []


class RoomOut(BaseModel):
    id: str
    name: str
    room_type: RoomType
    capacity: int
    status: RoomStatus
    description: Optional[str] = None
    hourly_rate: Optional[float] = None
    is_bookable: bool = True
    building_id: str
    building_name: str
    floor_id: str
    floor_name: str
    equipment: list[str] = []
    upcoming_bookings: list[BookingOut] = []


class TimeSlot(BaseModel):
    start_time: str
    end_time: str
    status: str  # "available" or "booked"
    booking_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------

class BookingCreateRequest(BaseModel):
    room_id: str
    title: str
    start_time: datetime
    end_time: datetime
    booking_type: BookingType = BookingType.internal_student


class BookingOut(BaseModel):
    id: str
    room_id: str
    room_name: str
    building_name: str
    user_id: str
    user_name: str
    title: str
    start_time: datetime
    end_time: datetime
    status: BookingStatus
    booking_type: BookingType
    created_at: datetime


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class UtilizationDataPoint(BaseModel):
    period: str
    utilization_pct: float


class HeatmapCell(BaseModel):
    day: int  # 0=Mon, 6=Sun
    hour: int  # 0-23
    value: float  # 0.0-1.0


class PeakHourData(BaseModel):
    hour: int
    avg_utilization: float


class DepartmentUsage(BaseModel):
    department: str
    total_hours: float
    total_bookings: int


# ---------------------------------------------------------------------------
# Revenue
# ---------------------------------------------------------------------------

class RevenueSummary(BaseModel):
    total: float
    external_rental: float
    chargebacks: float
    by_building: list[dict] = []
    by_room_type: list[dict] = []
    over_time: list[dict] = []


class RevenueOpportunity(BaseModel):
    room_id: str
    room_name: str
    building_name: str
    room_type: RoomType
    current_utilization_pct: float
    available_hours_per_week: float
    hourly_rate: float
    estimated_weekly_revenue: float


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

class AISearchRequest(BaseModel):
    query: str


class AISearchResult(BaseModel):
    room_id: str
    room_name: str
    building_name: str
    room_type: RoomType
    capacity: int
    confidence: float
    reasoning: str
    equipment: list[str] = []
    status: RoomStatus = RoomStatus.available


class AIRecommendation(BaseModel):
    room_id: str
    room_name: str
    building_name: str
    explanation: str
    relevance_score: float


class AIPrediction(BaseModel):
    building_id: str
    building_name: str
    date: str
    hour: int
    predicted_utilization: float


class AIAnomalyReport(BaseModel):
    id: str
    type: AnomalyType
    severity: Severity
    room_id: Optional[str] = None
    room_name: Optional[str] = None
    building_name: Optional[str] = None
    description: str
    recommended_action: str
    supporting_data: dict = {}
    detected_at: datetime


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginatedResponse(BaseModel):
    items: list = []
    total: int = 0
    page: int = 1
    page_size: int = 20


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

class WSEvent(BaseModel):
    event: str
    data: dict = {}
    timestamp: datetime
