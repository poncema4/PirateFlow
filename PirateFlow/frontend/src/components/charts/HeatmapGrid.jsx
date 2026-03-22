const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 12 }, (_, i) => `${i + 8}:00`);

function HeatmapCell({ value }) {
  const opacity = value / 100;
  const bg = `rgba(0, 75, 141, ${0.08 + opacity * 0.92})`;
  return (
    <div
      className="heatmap-cell"
      style={{ background: bg, color: value > 55 ? "#fff" : undefined }}
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
    <div className="heatmap-wrap">
      <div className="heatmap-row heatmap-row--header" style={{ gridTemplateColumns: `50px repeat(12, 1fr)` }}>
        <div />
        {hours.map((h) => (
          <div key={h} className="heatmap-hour-label">{h}</div>
        ))}
      </div>

      {days.map((day, di) => (
        <div key={day} className="heatmap-row" style={{ gridTemplateColumns: `50px repeat(12, 1fr)` }}>
          <div className="heatmap-day-label">{day}</div>
          {heatmap[di].map((val, hi) => (
            <HeatmapCell key={hi} value={val} />
          ))}
        </div>
      ))}

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Low</span>
        <div className="heatmap-legend-bar" />
        <span className="heatmap-legend-label">High</span>
      </div>
    </div>
  );
}
