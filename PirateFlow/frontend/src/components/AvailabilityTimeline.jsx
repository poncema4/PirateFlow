import { useMemo } from "react";

const HOURS_START = 8;   // 8am
const HOURS_END   = 22;  // 10pm
const TOTAL_HOURS = HOURS_END - HOURS_START; // 14

function formatHour(timeStr) {
  // "08:00" → "8am",  "13:00" → "1pm",  "12:00" → "12pm"
  const hour = parseInt(timeStr.split(":")[0], 10);
  if (hour === 0)  return "12am";
  if (hour < 12)   return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

/**
 * Reusable availability timeline bar.
 *
 * Props:
 *   slots          – TimeSlot[]  { start_time, end_time, status: "available"|"booked" }
 *   date           – "YYYY-MM-DD"  which day to display
 *   onSlotClick    – (startTime: string, endTime: string) => void
 *   highlightRange – { start: "HH:MM", end: "HH:MM" }  optional, shows selected range
 *   loading        – boolean
 */
export default function AvailabilityTimeline({
  slots = [],
  date,
  onSlotClick,
  highlightRange,
  loading = false,
}) {
  const today = new Date().toISOString().split("T")[0];
  const isToday = date === today;

  // Percentage position of the current time within the 8am–10pm window
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
        <div className="animate-pulse rounded-lg" style={{ height: 52, background: "var(--bg-card)", border: "1px solid var(--border)" }} />
        <div className="animate-pulse rounded" style={{ height: 14, width: "60%", background: "var(--bg-card)" }} />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No availability data for this date.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(0,200,150,0.2)", border: "1px solid rgba(0,200,150,0.4)" }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Available — click to select</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(232,68,90,0.3)", border: "1px solid rgba(232,68,90,0.4)" }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Booked</span>
        </div>
        {highlightRange && (
          <div className="flex items-center gap-1.5">
            <div style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(0,200,150,0.55)", border: "1px solid var(--accent)" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Selected</span>
          </div>
        )}
        {isToday && currentTimePos !== null && (
          <div className="flex items-center gap-1.5">
            <div style={{ width: 2, height: 12, background: "var(--danger)", borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Now</span>
          </div>
        )}
      </div>

      {/* Bar */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            height: 52,
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          {slots.map((slot, i) => {
            const booked     = slot.status === "booked";
            const highlighted = isHighlighted(slot);
            const isAvail    = slot.status === "available";

            const baseBg = highlighted
              ? "rgba(0,200,150,0.55)"
              : booked
              ? "rgba(232,68,90,0.25)"
              : "rgba(0,200,150,0.07)";

            const hoverBg = "rgba(0,200,150,0.22)";

            return (
              <div
                key={slot.start_time}
                title={
                  booked
                    ? `Booked  ${formatHour(slot.start_time)} – ${formatHour(slot.end_time)}`
                    : `Available  ${formatHour(slot.start_time)} – ${formatHour(slot.end_time)}`
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
                  if (isAvail && !highlighted) e.currentTarget.style.background = hoverBg;
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

      {/* Hour labels — shown every 2 hours to avoid crowding */}
      <div style={{ display: "flex" }}>
        {slots.map((slot, i) => (
          <div key={slot.start_time} style={{ flex: 1, textAlign: "center" }}>
            {i % 2 === 0 && (
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {formatHour(slot.start_time)}
              </span>
            )}
          </div>
        ))}
        {/* Final label at 10pm */}
        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>10pm</span>
      </div>
    </div>
  );
}
