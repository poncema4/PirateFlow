export interface Building {
  id: string
  name: string
  code: string
  total_floors: number
  room_count: number
  current_occupancy_pct: number
  occupied_rooms: number
}

export interface RoomSummary {
  id: string
  name: string
  room_type: string
  capacity: number
  status: "available" | "occupied" | "maintenance" | "closed"
  building_name: string
  floor_name: string
}

export interface Booking {
  id: string
  room_id: string
  room_name: string
  user_name: string
  title: string
  start_time: string
  end_time: string
  status: "confirmed" | "cancelled" | "completed" | "no_show"
  booking_type: string
}

export interface UtilizationDataPoint {
  period: string
  utilization_pct: number
}

export interface RevenueData {
  total: number
  external_rental: number
  chargebacks: number
  by_building: { building_name: string; amount: number }[]
  by_room_type: { room_type: string; amount: number }[]
  over_time: { period: string; amount: number }[]
}

export interface Anomaly {
  id: string
  type: "ghost_booking" | "phantom_usage" | "utilization_spike" | "space_hoarding" | "unusual_pattern"
  severity: "critical" | "warning" | "info"
  room_id: string
  room_name: string
  building_name: string
  description: string
  recommended_action: string
  detected_at: string
}

export interface WebSocketEvent {
  event: string
  data: Record<string, unknown>
  timestamp: string
}

export interface ActivityItem {
  id: string
  type: "occupancy" | "booking" | "anomaly"
  message: string
  timestamp: string
}