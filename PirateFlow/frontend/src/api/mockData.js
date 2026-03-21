export const mockBuildings = [
  { id: "1", name: "Walsh Library", code: "WL", total_floors: 4, room_count: 28, current_occupancy_pct: 72, occupied_rooms: 20 },
  { id: "2", name: "McNulty Hall", code: "MH", total_floors: 5, room_count: 34, current_occupancy_pct: 45, occupied_rooms: 15 },
  { id: "3", name: "Jubilee Hall", code: "JH", total_floors: 3, room_count: 18, current_occupancy_pct: 83, occupied_rooms: 15 },
  { id: "4", name: "Fahy Hall", code: "FH", total_floors: 4, room_count: 22, current_occupancy_pct: 31, occupied_rooms: 7 },
  { id: "5", name: "Corrigan Hall", code: "CH", total_floors: 3, room_count: 16, current_occupancy_pct: 56, occupied_rooms: 9 },
  { id: "6", name: "Stafford Hall", code: "SH", total_floors: 5, room_count: 24, current_occupancy_pct: 18, occupied_rooms: 4 },
];

export const mockStats = {
  total_rooms: 142,
  currently_occupied: 70,
  occupancy_pct: 49,
  todays_bookings: 89,
  active_alerts: 3,
  critical_alerts: 1,
};

export const mockActivityFeed = [
  { id: "1", type: "occupancy", message: "Room 204 in Walsh Library is now occupied", timestamp: new Date(Date.now() - 60000).toISOString() },
  { id: "2", type: "booking", message: "New booking: Study Room B, McNulty Hall", timestamp: new Date(Date.now() - 180000).toISOString() },
  { id: "3", type: "anomaly", message: "Anomaly detected: Ghost booking pattern in Jubilee Hall", timestamp: new Date(Date.now() - 300000).toISOString() },
  { id: "4", type: "occupancy", message: "Conference Room A in Fahy Hall is now available", timestamp: new Date(Date.now() - 420000).toISOString() },
  { id: "5", type: "booking", message: "Booking cancelled: Lab 101, Corrigan Hall", timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: "6", type: "occupancy", message: "Room 301 in Stafford Hall is now occupied", timestamp: new Date(Date.now() - 900000).toISOString() },
];

export const mockUtilizationData = [
  { period: "Mar 15", utilization_pct: 54 },
  { period: "Mar 16", utilization_pct: 61 },
  { period: "Mar 17", utilization_pct: 45 },
  { period: "Mar 18", utilization_pct: 38 },
  { period: "Mar 19", utilization_pct: 72 },
  { period: "Mar 20", utilization_pct: 68 },
  { period: "Mar 21", utilization_pct: 49 },
];

export const mockRevenueData = {
  total: 47230,
  external_rental: 32100,
  chargebacks: 15130,
  by_building: [
    { building_name: "Walsh Library", amount: 14200 },
    { building_name: "McNulty Hall", amount: 11800 },
    { building_name: "Jubilee Hall", amount: 9400 },
    { building_name: "Fahy Hall", amount: 6100 },
    { building_name: "Corrigan Hall", amount: 3800 },
    { building_name: "Stafford Hall", amount: 1930 },
  ],
  by_room_type: [
    { room_type: "Conference Room", amount: 21000 },
    { room_type: "Study Room", amount: 12500 },
    { room_type: "Computer Lab", amount: 8200 },
    { room_type: "Lecture Hall", amount: 5530 },
  ],
  over_time: [
    { period: "Oct", amount: 6200 },
    { period: "Nov", amount: 8100 },
    { period: "Dec", amount: 4300 },
    { period: "Jan", amount: 7800 },
    { period: "Feb", amount: 9400 },
    { period: "Mar", amount: 11430 },
  ],
};

export const mockAnomalies = [
  {
    id: "1",
    type: "ghost_booking",
    severity: "critical",
    room_id: "r1",
    room_name: "Room 302",
    building_name: "Jubilee Hall",
    description: "User John Smith has booked Room 302 in Jubilee Hall 14 times in the past month with a 71% no-show rate.",
    recommended_action: "Consider implementing a no-show penalty policy for repeat offenders.",
    detected_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "2",
    type: "utilization_spike",
    severity: "warning",
    room_id: "r2",
    room_name: "Study Room B",
    building_name: "Walsh Library",
    description: "Study Room B has seen a 340% increase in bookings this week compared to the monthly average.",
    recommended_action: "Consider opening additional study rooms on the same floor during peak hours.",
    detected_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "3",
    type: "phantom_usage",
    severity: "warning",
    room_id: "r3",
    room_name: "Lab 101",
    building_name: "Corrigan Hall",
    description: "Lab 101 shows occupancy sensor activity outside of any scheduled bookings between 11pm-2am on weekdays.",
    recommended_action: "Review access logs and verify whether unauthorized usage is occurring.",
    detected_at: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: "4",
    type: "space_hoarding",
    severity: "info",
    room_id: "r4",
    room_name: "Conference Room A",
    building_name: "Stafford Hall",
    description: "Conference Room A is booked every weekday 9am-5pm by the same department but actual occupancy averages only 12%.",
    recommended_action: "Reach out to the department to discuss a shared booking arrangement.",
    detected_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const mockHeatmapData = Array.from({ length: 7 }, (_, dayIndex) =>
  Array.from({ length: 12 }, (_, hourIndex) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dayIndex],
    hour: hourIndex + 8,
    value: Math.floor(Math.random() * 100),
  }))
).flat();

export const mockUnderutilized = [
  { room_name: "Conference Room C", building: "Stafford Hall", type: "Conference Room", utilization_pct: 12, available_hours: 40, hourly_rate: 85, weekly_potential: 2980 },
  { room_name: "Seminar Room 2", building: "Fahy Hall", type: "Seminar Room", utilization_pct: 18, available_hours: 35, hourly_rate: 65, weekly_potential: 1872 },
  { room_name: "Lab 203", building: "McNulty Hall", type: "Computer Lab", utilization_pct: 22, available_hours: 30, hourly_rate: 70, weekly_potential: 1638 },
  { room_name: "Meeting Room B", building: "Corrigan Hall", type: "Meeting Room", utilization_pct: 27, available_hours: 28, hourly_rate: 45, weekly_potential: 1134 },
];