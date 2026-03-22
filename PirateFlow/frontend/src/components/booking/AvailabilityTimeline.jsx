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
      <div className="timeline-loading">
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="timeline-empty">No availability data for this date.</p>
    );
  }

  return (
    <div className="timeline-wrap">
      {/* Legend */}
      <div className="timeline-legend">
        <div className="timeline-legend-item">
          <div className="timeline-legend-dot" style={{ background: "rgba(0,75,141,0.2)", borderColor: "rgba(0,75,141,0.4)" }} />
          <span className="timeline-legend-label">Available</span>
        </div>
        <div className="timeline-legend-item">
          <div className="timeline-legend-dot" style={{ background: "rgba(232,68,90,0.3)", borderColor: "rgba(232,68,90,0.4)" }} />
          <span className="timeline-legend-label">Booked</span>
        </div>
        {highlightRange && (
          <div className="timeline-legend-item">
            <div className="timeline-legend-dot" style={{ background: "rgba(0,75,141,0.55)", borderColor: "var(--accent)" }} />
            <span className="timeline-legend-label">Selected</span>
          </div>
        )}
        {isToday && currentTimePos !== null && (
          <div className="timeline-legend-item">
            <div className="timeline-legend-dot timeline-legend-dot--now" style={{ background: "var(--danger)" }} />
            <span className="timeline-legend-label">Now</span>
          </div>
        )}
      </div>

      {/* Bar */}
      <div className="timeline-bar-wrap">
        <div className="timeline-bar">
          {slots.map((slot, i) => {
            const booked = slot.status === "booked";
            const highlighted = isHighlighted(slot);
            const isAvail = slot.status === "available";

            const cls = [
              "timeline-slot",
              isAvail ? "available" : "",
              booked ? "booked" : "",
              highlighted ? "highlighted" : "",
            ].filter(Boolean).join(" ");

            return (
              <div
                key={slot.start_time}
                className={cls}
                title={
                  booked
                    ? `Booked  ${formatHour(slot.start_time)} \u2013 ${formatHour(slot.end_time)}`
                    : `Available  ${formatHour(slot.start_time)} \u2013 ${formatHour(slot.end_time)}`
                }
                onClick={() => isAvail && onSlotClick?.(slot.start_time, slot.end_time)}
              />
            );
          })}
        </div>

        {/* Current-time needle */}
        {currentTimePos !== null && (
          <div className="timeline-now" style={{ left: `${currentTimePos}%` }} />
        )}
      </div>

      {/* Hour labels */}
      <div className="timeline-hours">
        {slots.map((slot, i) => (
          <div key={slot.start_time} className="timeline-hour">
            {i % 2 === 0 && (
              <span>{formatHour(slot.start_time)}</span>
            )}
          </div>
        ))}
        <span className="timeline-hour timeline-hour--end">10pm</span>
      </div>
    </div>
  );
}
