export default function StatsCard({ label, value, sub, accent = false, danger = false, trend = null }) {
  const trendColor = trend?.direction === "up" ? "var(--success)" : "var(--danger)";
  const trendArrow = trend?.direction === "up" ? "\u2191" : "\u2193";
  const valueColor = danger ? "var(--danger)" : accent ? "var(--accent)" : "var(--text-primary)";
  const borderColor = danger ? "var(--danger)" : accent ? "var(--accent)" : "var(--border)";

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1.5"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${borderColor}`,
        boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.06)",
      }}
    >
      <p style={{
        fontSize: 11,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontWeight: 600,
      }}>
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p
          style={{
            fontSize: 32,
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            color: valueColor,
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
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</p>
      )}
    </div>
  );
}
