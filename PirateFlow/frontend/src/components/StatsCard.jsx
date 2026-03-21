export default function StatsCard({ label, value, sub, accent = false, danger = false, trend = null }) {
  const trendColor = trend?.direction === "up" ? "var(--success)" : "var(--danger)";
  const trendArrow = trend?.direction === "up" ? "↑" : "↓";

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${danger ? "var(--danger)" : accent ? "var(--accent)" : "var(--border)"}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
      }}
    >
      <p style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p
          style={{
            fontSize: "32px",
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            color: danger ? "var(--danger)" : accent ? "var(--accent)" : "var(--text-primary)",
            lineHeight: 1,
          }}
        >
          {value}
        </p>
        {trend && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full mb-1"
            style={{ background: `${trendColor}22`, color: trendColor }}
          >
            {trendArrow} {trend.pct}%
          </span>
        )}
      </div>
      {sub && (
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{sub}</p>
      )}
    </div>
  );
}