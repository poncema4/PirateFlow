import { useMemo } from "react";

const HOURS_START = 8;
const HOURS_END = 22;
const TOTAL_HOURS = HOURS_END - HOURS_START;

function formatHour(timeStr) {
  const hour = parseInt(timeStr.split(":")[0], 10);
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

export default function AvailabilityTimeline({
  slots = [],
  date,
  onSlotClick,
  highlightRange,
  loading = false,
}) {
  const today = new Date().toISOString().split("T")[0];
  const isToday = date === today;

  const currentTimePos = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    if (hours < HOURS_START || hours > HOURS_END) return null;
    return ((hours - HOURS_START) / TOTAL_HOURS) * 100;
  }, [isToday]);

  const isHighlighted = (slot) => {
    if (!highlightRange) return false;
    return slot.start_time >= highlightRange.start && slot.end_time <= highlightRange.end;
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="animate-pulse rounded-lg" style={{ height: 44, background: "var(--bg-card)", border: "1px solid var(--border)" }} />
        <div className="animate-pulse rounded" style={{ height: 12, width: "60%", background: "var(--bg-card)" }} />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No availability data for this date.</p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(0,75,141,0.2)", border: "1px solid rgba(0,75,141,0.4)" }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(232,68,90,0.3)", border: "1px solid rgba(232,68,90,0.4)" }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Booked</span>
        </div>
        {highlightRange && (
          <div className="flex items-center gap-1">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(0,75,141,0.55)", border: "1px solid var(--accent)" }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Selected</span>
          </div>
        )}
        {isToday && currentTimePos !== null && (
          <div className="flex items-center gap-1">
            <div style={{ width: 2, height: 10, background: "var(--danger)", borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Now</span>
          </div>
        )}
      </div>

      {/* Bar */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            height: 44,
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          {slots.map((slot, i) => {
            const booked = slot.status === "booked";
            const highlighted = isHighlighted(slot);
            const isAvail = slot.status === "available";

            const baseBg = highlighted
              ? "rgba(0,75,141,0.55)"
              : booked
              ? "rgba(232,68,90,0.25)"
              : "rgba(0,75,141,0.07)";

            return (
              <div
                key={slot.start_time}
                title={
                  booked
                    ? `Booked  ${formatHour(slot.start_time)} \u2013 ${formatHour(slot.end_time)}`
                    : `Available  ${formatHour(slot.start_time)} \u2013 ${formatHour(slot.end_time)}`
                }
                onClick={() => isAvail && onSlotClick?.(slot.start_time, slot.end_time)}
                style={{
                  flex: 1,
                  background: baseBg,
                  borderRight: i < slots.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  cursor: isAvail ? "pointer" : "default",
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => {
                  if (isAvail && !highlighted) e.currentTarget.style.background = "rgba(0,75,141,0.22)";
                }}
                onMouseLeave={(e) => {
                  if (isAvail && !highlighted) e.currentTarget.style.background = baseBg;
                }}
              />
            );
          })}
        </div>

        {/* Current-time needle */}
        {currentTimePos !== null && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: `${currentTimePos}%`,
              height: "100%",
              width: 2,
              background: "var(--danger)",
              borderRadius: 1,
              zIndex: 10,
              pointerEvents: "none",
              boxShadow: "0 0 4px var(--danger)",
            }}
          />
        )}
      </div>

      {/* Hour labels */}
      <div style={{ display: "flex" }}>
        {slots.map((slot, i) => (
          <div key={slot.start_time} style={{ flex: 1, textAlign: "center" }}>
            {i % 2 === 0 && (
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
                {formatHour(slot.start_time)}
              </span>
            )}
          </div>
        ))}
        <span style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>10pm</span>
      </div>
    </div>
  );
}
