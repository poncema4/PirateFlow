const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 12 }, (_, i) => `${i + 8}:00`);

function HeatmapCell({ value }) {
  const opacity = value / 100;
  const bg = `rgba(0, 75, 141, ${0.08 + opacity * 0.92})`;
  return (
    <div
      className="rounded flex items-center justify-center cursor-pointer transition-all"
      style={{ background: bg, color: value > 55 ? "#fff" : "var(--text-muted)", fontSize: 9, height: 26 }}
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
      <div className="grid mb-1" style={{ gridTemplateColumns: `50px repeat(12, 1fr)`, gap: 2, minWidth: 560 }}>
        <div />
        {hours.map((h) => (
          <div key={h} style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>{h}</div>
        ))}
      </div>

      {days.map((day, di) => (
        <div key={day} className="grid mb-1" style={{ gridTemplateColumns: `50px repeat(12, 1fr)`, gap: 2, minWidth: 560 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{day}</div>
          {heatmap[di].map((val, hi) => (
            <HeatmapCell key={hi} value={val} />
          ))}
        </div>
      ))}

      <div className="flex items-center gap-2 mt-3">
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Low</span>
        <div style={{ height: 6, flex: 1, borderRadius: 3, background: "linear-gradient(90deg, rgba(0,75,141,0.08), rgba(0,75,141,1))" }} />
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>High</span>
      </div>
    </div>
  );
}
