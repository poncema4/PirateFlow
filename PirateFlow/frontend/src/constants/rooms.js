// Shared constants for room types, equipment, and status display.
// Used across Landing, BuildingDetail, RoomExpandedPanel, CreateBooking.

export const ROOM_TYPE_LABELS = {
  study_room: "Study Room",
  computer_lab: "Computer Lab",
  lecture_hall: "Lecture Hall",
  science_lab: "Science Lab",
  conference_room: "Conference Room",
  event_space: "Event Space",
  multipurpose: "Multipurpose",
  classroom: "Classroom",
};

export const EQUIPMENT_ICONS = {
  projector: "⊞",
  whiteboard: "▭",
  video_conferencing: "◎",
  smart_board: "◼",
  computers: "⌨",
  lab_equipment: "⚗",
  power_outlets: "⚡",
  recording_studio: "◉",
};

export const EQUIPMENT_LABELS = {
  projector: "Projector",
  whiteboard: "Whiteboard",
  video_conferencing: "Video Conferencing",
  smart_board: "Smart Board",
  computers: "Computers",
  lab_equipment: "Lab Equipment",
  power_outlets: "Power Outlets",
  recording_studio: "Recording Studio",
};

export const STATUS_INFO = {
  available: { label: "Available", color: "var(--success)" },
  occupied: { label: "Occupied", color: "var(--danger)" },
  maintenance: { label: "Maintenance", color: "var(--warning)" },
  closed: { label: "Closed", color: "var(--text-muted)" },
};

export const BOOKING_TYPE_OPTIONS = [
  { value: "internal_student", label: "Student (personal)" },
  { value: "internal_staff", label: "Staff (work-related)" },
  { value: "internal_department", label: "Department event" },
  { value: "external", label: "External / community" },
];
