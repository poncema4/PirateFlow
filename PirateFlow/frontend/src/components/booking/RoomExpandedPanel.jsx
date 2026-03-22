import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { ROOM_TYPE_LABELS, EQUIPMENT_ICONS, EQUIPMENT_LABELS, STATUS_INFO } from "../../constants/rooms";
import AvailabilityTimeline from "./AvailabilityTimeline";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${suffix}`;
}

export default function RoomExpandedPanel({ roomId, onClose, onBook }) {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    api.getRoom(roomId)
      .then(setRoom)
      .catch(() => setError("Failed to load room details."))
      .finally(() => setLoading(false));
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    api.getRoomAvailability(roomId, selectedDate)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [roomId, selectedDate]);

  const handleSlotClick = (start, end) => {
    setSelectedSlot((prev) => (prev?.start === start ? null : { start, end }));
  };

  const handleBook = () => {
    if (!room) return;
    onBook(roomId, room.name, selectedDate, selectedSlot?.start || "", selectedSlot?.end || "");
  };

  const status = STATUS_INFO[room?.status] ?? STATUS_INFO.closed;
  const canBook = room?.is_bookable && room?.status !== "maintenance" && room?.status !== "closed";

  if (loading) {
    return (
      <div style={{ gridColumn: "1 / -1", padding: 16, background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border)" }}>
        <div className="animate-pulse flex flex-col gap-3">
          <div style={{ height: 18, width: "40%", background: "var(--bg-card)", borderRadius: 6 }} />
          <div style={{ height: 44, background: "var(--bg-card)", borderRadius: 6 }} />
          <div style={{ height: 14, width: "60%", background: "var(--bg-card)", borderRadius: 6 }} />
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div style={{ gridColumn: "1 / -1", padding: 16, background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border)", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>{error || "Room not found"}</p>
        <button onClick={onClose} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        background: "var(--bg-primary)",
        border: `1px solid ${status.color}25`,
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: "slideDown 200ms ease-out",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              {room.name}
            </h3>
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: status.color + "18", color: status.color, border: `1px solid ${status.color}30`, fontWeight: 600 }}>
              {status.label}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
            {room.building_name} &middot; {room.floor_name}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer", flexShrink: 0, transition: "border-color 150ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          &times; Close
        </button>
      </div>

      {/* Info tags */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--border)", color: "var(--text-muted)" }}>
            {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--border)", color: "var(--text-muted)" }}>
            {room.capacity} people
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--border)", color: "var(--text-muted)" }}>
            {room.hourly_rate ? `$${room.hourly_rate}/hr` : "Free"}
          </span>
        </div>
        {room.equipment?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {room.equipment.map((eq) => (
              <span key={eq} className="px-2 py-0.5 rounded text-xs" style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                {EQUIPMENT_ICONS[eq] || "\u00B7"} {EQUIPMENT_LABELS[eq] || eq.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Date controls + availability */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Availability</p>
          <div className="flex items-center gap-2">
            {[
              { label: "Today", value: todayStr() },
              { label: "Tomorrow", value: tomorrowStr() },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setSelectedDate(value)}
                style={{
                  background: selectedDate === value ? "var(--accent-muted)" : "var(--bg-card)",
                  color: selectedDate === value ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${selectedDate === value ? "rgba(0,75,141,0.3)" : "var(--border)"}`,
                  borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", transition: "all 150ms",
                }}
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              value={selectedDate}
              min={todayStr()}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 6px", fontSize: 10, color: "var(--text-muted)", outline: "none", cursor: "pointer" }}
            />
          </div>
        </div>

        <AvailabilityTimeline
          slots={slots}
          date={selectedDate}
          onSlotClick={handleSlotClick}
          highlightRange={selectedSlot ? { start: selectedSlot.start, end: selectedSlot.end } : null}
          loading={slotsLoading}
        />
      </div>

      {/* Selected slot + Book CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          {selectedSlot ? (
            <p style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
              Selected: {formatTime(selectedSlot.start)} &ndash; {formatTime(selectedSlot.end)}
              <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </p>
          ) : (
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Click a time slot to select
            </p>
          )}
        </div>

        <button
          onClick={handleBook}
          disabled={!canBook}
          style={{
            background: canBook ? "var(--accent)" : "var(--border)",
            color: canBook ? "#000" : "var(--text-muted)",
            border: "none", borderRadius: 8, padding: "8px 20px",
            fontSize: 12, fontWeight: 700, cursor: canBook ? "pointer" : "not-allowed",
            transition: "opacity 150ms", flexShrink: 0,
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
