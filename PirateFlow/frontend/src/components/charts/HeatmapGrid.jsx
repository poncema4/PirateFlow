const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 12 }, (_, i) => `${i + 8}:00`);

function HeatmapCell({ value }) {
  const opacity = value / 100;
  const bg = `rgba(0, 200, 150, ${0.08 + opacity * 0.92})`;
  return (
    <div
      className="rounded flex items-center justify-center cursor-pointer transition-all"
      style={{ background: bg, color: value > 55 ? "#000" : "var(--text-muted)", fontSize: "10px", height: 28 }}
      title={`${value}% utilization`}
    >
      {value}%
    </div>
  );
}

export default function HeatmapGrid({ data = [] }) {
  const heatmap = days.map((day) =>
    hours.map((_, hi) => {
      const found = data.find((d) => d.day === day && d.hour === hi + 8);
      return found ? found.value : 0;
    })
  );

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Hour labels */}
      <div className="grid mb-1" style={{ gridTemplateColumns: `60px repeat(12, 1fr)`, gap: 3, minWidth: 600 }}>
        <div />
        {hours.map((h) => (
          <div key={h} style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center" }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {days.map((day, di) => (
        <div key={day} className="grid mb-1" style={{ gridTemplateColumns: `60px repeat(12, 1fr)`, gap: 3, minWidth: 600 }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{day}</div>
          {heatmap[di].map((val, hi) => (
            <HeatmapCell key={hi} value={val} />
          ))}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4">
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Low</span>
        <div style={{ height: 8, flex: 1, borderRadius: 4, background: "linear-gradient(90deg, rgba(0,200,150,0.08), rgba(0,200,150,1))" }} />
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>High</span>
      </div>
    </div>
  );
}