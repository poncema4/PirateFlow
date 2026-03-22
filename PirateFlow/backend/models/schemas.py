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
    maker_space = "maker_space"


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
    unauthorized_access = "unauthorized_access"


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


class StudentLookupRequest(BaseModel):
    student_id: str
    password: str


class UserCreateRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: UserRole = UserRole.student
    department: Optional[str] = None
    major: Optional[str] = None
    year: Optional[str] = None
    student_id: Optional[str] = None


class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None
    department: Optional[str] = None
    major: Optional[str] = None
    year: Optional[str] = None
    student_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Buildings & Floors
# ---------------------------------------------------------------------------

class BuildingCreateRequest(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    total_floors: int = 1
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class BuildingUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    total_floors: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class FloorCreateRequest(BaseModel):
    floor_number: int
    name: str


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

class RoomCreateRequest(BaseModel):
    floor_id: str
    name: str
    room_type: RoomType
    capacity: int
    hourly_rate: Optional[float] = None
    is_bookable: bool = True
    description: Optional[str] = None
    equipment: list[str] = []


class RoomUpdateRequest(BaseModel):
    name: Optional[str] = None
    room_type: Optional[RoomType] = None
    capacity: Optional[int] = None
    hourly_rate: Optional[float] = None
    is_bookable: Optional[bool] = None
    status: Optional[RoomStatus] = None
    description: Optional[str] = None
    equipment: Optional[list[str]] = None


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


class AnalyticsSummary(BaseModel):
    total_bookings: int
    avg_daily_users: float
    most_popular_type: str
    most_popular_type_count: int
    avg_duration_hrs: float
    total_unique_users: int


class RoomTypePopularity(BaseModel):
    room_type: str
    total_bookings: int
    total_hours: float


class TopRoom(BaseModel):
    room_name: str
    building_name: str
    room_type: str
    capacity: int
    total_bookings: int
    total_hours: float


class BookingTypeBreakdown(BaseModel):
    booking_type: str
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
# Face Access Control
# ---------------------------------------------------------------------------

class FaceRegisterRequest(BaseModel):
    image_base64: str


class FaceRegisterResponse(BaseModel):
    user_id: str
    status: str  # "registered" or "updated"
    message: str


class FaceVerifyRequest(BaseModel):
    room_id: str
    image_base64: str


class FaceVerifyResponse(BaseModel):
    recognized: bool
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    has_valid_booking: Optional[bool] = None
    confidence: Optional[float] = None
    alert_sent: bool = False


class AccessLogEntry(BaseModel):
    id: str
    room_id: str
    room_name: str
    detected_user_id: Optional[str] = None
    detected_user_name: Optional[str] = None
    matched_confidence: Optional[float] = None
    had_valid_booking: bool
    alert_sent: bool
    captured_at: datetime


# ---------------------------------------------------------------------------
# Cameras & Access Rules
# ---------------------------------------------------------------------------

class CameraCreateRequest(BaseModel):
    room_id: str
    name: str
    rtsp_url: Optional[str] = None
    doorway_polygon: Optional[list[list[float]]] = None  # [[x,y], ...] normalized 0-1
    room_direction: Optional[list[float]] = None  # [dx, dy] unit vector pointing into room
    entry_direction: str = "top_to_bottom"


class CameraUpdateRequest(BaseModel):
    name: Optional[str] = None
    rtsp_url: Optional[str] = None
    status: Optional[str] = None
    doorway_polygon: Optional[list[list[float]]] = None
    room_direction: Optional[list[float]] = None
    entry_direction: Optional[str] = None


class CameraOut(BaseModel):
    id: str
    room_id: str
    room_name: Optional[str] = None
    building_name: Optional[str] = None
    name: str
    rtsp_url: Optional[str] = None
    status: str
    doorway_polygon: Optional[list[list[float]]] = None
    room_direction: Optional[list[float]] = None
    entry_direction: str = "top_to_bottom"
    installed_at: str


class AccessRuleCreateRequest(BaseModel):
    role: Optional[str] = None
    user_id: Optional[str] = None
    room_id: Optional[str] = None
    building_id: Optional[str] = None
    day_of_week: Optional[str] = None  # "monday,tuesday,..." or None for all
    start_hour: int = 0
    end_hour: int = 23


class AccessRuleOut(BaseModel):
    id: str
    role: Optional[str] = None
    user_id: Optional[str] = None
    room_id: Optional[str] = None
    building_id: Optional[str] = None
    day_of_week: Optional[str] = None
    start_hour: int
    end_hour: int
    created_at: str


class AccessEventOut(BaseModel):
    id: str
    camera_id: str
    room_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    direction: str  # "entry" or "exit"
    authorized: bool
    confidence: Optional[float] = None
    timestamp: str


class AlertOut(BaseModel):
    id: str
    event_id: Optional[str] = None
    room_id: Optional[str] = None
    user_id: Optional[str] = None
    alert_type: str
    severity: str
    description: str
    acknowledged: bool = False
    created_at: str


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
