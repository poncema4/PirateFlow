import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import AvailabilityTimeline from "../components/AvailabilityTimeline";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROOM_TYPE_LABELS = {
  study_room:      "Study Room",
  computer_lab:    "Computer Lab",
  lecture_hall:    "Lecture Hall",
  science_lab:     "Science Lab",
  conference_room: "Conference Room",
  event_space:     "Event Space",
  multipurpose:    "Multipurpose",
  classroom:       "Classroom",
};

const EQUIPMENT_ICONS = {
  projector:         "⊞ Projector",
  whiteboard:        "▭ Whiteboard",
  video_conferencing:"◎ Video Conferencing",
  smart_board:       "◼ Smart Board",
  computers:         "⌨ Computers",
  lab_equipment:     "⚗ Lab Equipment",
  power_outlets:     "⚡ Power Outlets",
  recording_studio:  "◉ Recording Studio",
};

const STATUS_INFO = {
  available:   { label: "Available",    color: "var(--success)" },
  occupied:    { label: "Occupied",     color: "var(--danger)"  },
  maintenance: { label: "Maintenance",  color: "var(--warning)" },
  closed:      { label: "Closed",       color: "var(--text-muted)" },
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatTime(timeStr) {
  // "14:00" → "2:00pm"
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ height, width = "100%", className = "" }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ height, width, background: "var(--bg-card)", border: "1px solid var(--border)", flexShrink: 0 }}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RoomDetail() {
  const { buildingId, roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom]               = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomError, setRoomError]     = useState("");

  const [slots, setSlots]             = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedSlot, setSelectedSlot] = useState(null); // { start, end }

  useEffect(() => {
    fetchRoom();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (roomId) fetchSlots(selectedDate);
  }, [roomId, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRoom = async () => {
    setRoomLoading(true);
    setRoomError("");
    try {
      const data = await api.getRoom(roomId);
      setRoom(data);
    } catch {
      setRoomError("Failed to load room details. Please try again.");
    } finally {
      setRoomLoading(false);
    }
  };

  const fetchSlots = async (date) => {
    setSlotsLoading(true);
    setSelectedSlot(null); // clear selection when date changes
    try {
      const data = await api.getRoomAvailability(roomId, date);
      setSlots(data);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSlotClick = (start, end) => {
    // Toggle: clicking the same slot deselects it
    setSelectedSlot((prev) =>
      prev?.start === start ? null : { start, end }
    );
  };

  const handleBook = () => {
    if (!room) return;
    const params = new URLSearchParams({ roomId, roomName: room.name });
    if (selectedSlot) {
      params.set("date", selectedDate);
      params.set("startTime", selectedSlot.start);
      params.set("endTime", selectedSlot.end);
    }
    navigate(`/bookings/new?${params.toString()}`);
  };

  const status  = STATUS_INFO[room?.status] ?? STATUS_INFO.closed;
  const canBook = room?.is_bookable && room?.status !== "maintenance" && room?.status !== "closed";

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (roomLoading) {
    return (
      <div className="p-6 flex flex-col gap-6" style={{ maxWidth: 860, margin: "0 auto" }}>
        <Skeleton height={16} width={160} />
        <Skeleton height={100} />
        <Skeleton height={56} />
        <Skeleton height={140} />
        <Skeleton height={100} />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (roomError || !room) {
    return (
      <div className="p-6 flex flex-col gap-4 items-center" style={{ maxWidth: 860, margin: "0 auto", paddingTop: 80 }}>
        <p style={{ fontSize: 32 }}>◻</p>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
          {roomError || "Room not found"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={fetchRoom}
            style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Retry
          </button>
          <button
            onClick={() => navigate(`/spaces/${buildingId}`)}
            style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}
          >
            Back to Building
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 flex flex-col gap-6" style={{ maxWidth: 860, margin: "0 auto" }}>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text-muted)" }}>
        <Link
          to="/spaces"
          style={{ color: "var(--text-muted)", textDecoration: "none", transition: "color 150ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          Spaces
        </Link>
        <span>›</span>
        <Link
          to={`/spaces/${buildingId}`}
          style={{ color: "var(--text-muted)", textDecoration: "none", transition: "color 150ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          {room.building_name}
        </Link>
        <span>›</span>
        <span style={{ color: "var(--text-primary)" }}>{room.name}</span>
      </nav>

      {/* ── Room Header ───────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-6 flex flex-col gap-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Name + status */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.5px",
              }}
            >
              {room.name}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {room.building_name} · {room.floor_name}
            </p>
          </div>

          {/* Status badge */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl flex-shrink-0"
            style={{
              background: status.color + "14",
              border: `1px solid ${status.color}33`,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: status.color,
                display: "inline-block",
                boxShadow: `0 0 6px ${status.color}`,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: status.color }}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Metadata pills */}
        <div className="flex flex-wrap gap-2">
          <span
            className="px-3 py-1 rounded-full text-sm"
            style={{ background: "var(--border)", color: "var(--text-muted)" }}
          >
            {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
          </span>
          <span
            className="px-3 py-1 rounded-full text-sm"
            style={{ background: "var(--border)", color: "var(--text-muted)" }}
          >
            ◫ {room.capacity} people
          </span>
          <span
            className="px-3 py-1 rounded-full text-sm"
            style={{ background: "var(--border)", color: "var(--text-muted)" }}
          >
            {room.hourly_rate ? `$${room.hourly_rate}/hr` : "Free for students"}
          </span>
        </div>

        {/* Description */}
        {room.description && (
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {room.description}
          </p>
        )}

        {/* Equipment grid */}
        {room.equipment?.length > 0 && (
          <div className="flex flex-col gap-2">
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Equipment
            </p>
            <div className="flex flex-wrap gap-2">
              {room.equipment.map((eq) => (
                <span
                  key={eq}
                  className="px-3 py-1 rounded-lg text-sm"
                  style={{
                    background: "var(--bg-primary)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {EQUIPMENT_ICONS[eq] || eq.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Availability Timeline ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-6 flex flex-col gap-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Section header + date controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            Availability
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick-select buttons */}
            {[
              { label: "Today",    value: todayStr()    },
              { label: "Tomorrow", value: tomorrowStr() },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setSelectedDate(value)}
                style={{
                  background: selectedDate === value ? "var(--accent-muted)" : "var(--bg-primary)",
                  color: selectedDate === value ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${selectedDate === value ? "rgba(0,200,150,0.3)" : "var(--border)"}`,
                  borderRadius: 6,
                  padding: "5px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 150ms",
                }}
              >
                {label}
              </button>
            ))}

            {/* Date picker */}
            <input
              type="date"
              value={selectedDate}
              min={todayStr()}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                color: "var(--text-muted)",
                outline: "none",
                cursor: "pointer",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>
        </div>

        {/* Timeline */}
        <AvailabilityTimeline
          slots={slots}
          date={selectedDate}
          onSlotClick={handleSlotClick}
          highlightRange={selectedSlot ? { start: selectedSlot.start, end: selectedSlot.end } : null}
          loading={slotsLoading}
        />

        {/* Selected slot summary */}
        {selectedSlot && (
          <div
            className="rounded-lg px-4 py-3 flex items-center justify-between gap-4"
            style={{
              background: "rgba(0,200,150,0.08)",
              border: "1px solid rgba(0,200,150,0.25)",
            }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                Selected: {formatTime(selectedSlot.start)} – {formatTime(selectedSlot.end)}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            <button
              onClick={() => setSelectedSlot(null)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ── Book This Room CTA ────────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            Ready to book?
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            {selectedSlot
              ? `${formatTime(selectedSlot.start)} – ${formatTime(selectedSlot.end)} pre-selected`
              : "Select a time slot above, or choose in the booking form"}
          </p>
        </div>

        <button
          onClick={handleBook}
          disabled={!canBook}
          title={!canBook ? "This room is not available for booking" : undefined}
          style={{
            background: canBook ? "var(--accent)" : "var(--border)",
            color: canBook ? "#000" : "var(--text-muted)",
            border: "none",
            borderRadius: 10,
            padding: "12px 28px",
            fontSize: 14,
            fontWeight: 700,
            cursor: canBook ? "pointer" : "not-allowed",
            transition: "opacity 150ms",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { if (canBook) e.currentTarget.style.opacity = "0.88"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Book This Room
        </button>
      </div>
    </div>
  );
}
