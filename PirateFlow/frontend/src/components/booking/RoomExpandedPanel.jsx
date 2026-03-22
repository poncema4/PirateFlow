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
      <div className="room-panel">
        <div className="skeleton" style={{ height: 18, width: "40%" }} />
        <div className="skeleton" style={{ height: 44 }} />
        <div className="skeleton" style={{ height: 14, width: "60%" }} />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="room-panel">
        <p className="alert-danger">{error || "Room not found"}</p>
        <button onClick={onClose} className="btn btn-secondary btn-sm">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="room-panel">
      {/* Header */}
      <div className="room-panel-header">
        <div>
          <div className="room-panel-title">
            <h3>{room.name}</h3>
            <span className="status-badge" style={{ color: status.color, background: status.color + "18", borderColor: status.color + "30" }}>
              {status.label}
            </span>
          </div>
          <p className="room-panel-subtitle">
            {room.building_name} &middot; {room.floor_name}
          </p>
        </div>
        <button onClick={onClose} className="btn btn-secondary btn-sm">
          &times; Close
        </button>
      </div>

      {/* Info tags */}
      <div className="room-panel-tags">
        <span className="room-panel-tag">
          {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
        </span>
        <span className="room-panel-tag">
          {room.capacity} people
        </span>
        <span className="room-panel-tag">
          {room.hourly_rate ? `$${room.hourly_rate}/hr` : "Free"}
        </span>
        {room.equipment?.length > 0 && (
          room.equipment.map((eq) => (
            <span key={eq} className="room-panel-equip-tag">
              {EQUIPMENT_ICONS[eq] || "\u00B7"} {EQUIPMENT_LABELS[eq] || eq.replace(/_/g, " ")}
            </span>
          ))
        )}
      </div>

      {/* Date controls + availability */}
      <div className="room-panel-avail">
        <div className="room-panel-avail-header">
          <p className="room-panel-avail-label">Availability</p>
          <div className="room-panel-avail-btns">
            {[
              { label: "Today", value: todayStr() },
              { label: "Tomorrow", value: tomorrowStr() },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setSelectedDate(value)}
                className={`room-panel-date-btn${selectedDate === value ? " active" : ""}`}
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              value={selectedDate}
              min={todayStr()}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="room-panel-date-input"
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
      <div className="room-panel-footer">
        <div>
          {selectedSlot ? (
            <p className="room-panel-selected">
              Selected: {formatTime(selectedSlot.start)} &ndash; {formatTime(selectedSlot.end)}
              <span className="room-panel-selected-date">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
            </p>
          ) : (
            <p className="room-panel-hint">
              Click a time slot to select
            </p>
          )}
        </div>

        <button
          onClick={handleBook}
          disabled={!canBook}
          className={`btn ${canBook ? "btn-primary" : ""}`}
        >
          Book This Room
        </button>
      </div>
    </div>
  );
}
