function StatsIcon({ type }) {
  const icons = {
    buildings: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <path d="M9 22v-4h6v4"/>
        <line x1="8" y1="6" x2="8" y2="6.01"/>
        <line x1="12" y1="6" x2="12" y2="6.01"/>
        <line x1="16" y1="6" x2="16" y2="6.01"/>
        <line x1="8" y1="10" x2="8" y2="10.01"/>
        <line x1="12" y1="10" x2="12" y2="10.01"/>
        <line x1="16" y1="10" x2="16" y2="10.01"/>
        <line x1="8" y1="14" x2="8" y2="14.01"/>
        <line x1="12" y1="14" x2="12" y2="14.01"/>
        <line x1="16" y1="14" x2="16" y2="14.01"/>
      </svg>
    ),
    rooms: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19V9l-10-6L2 9v10"/>
        <path d="M2 19h20"/>
        <rect x="6" y="12" width="4" height="7"/>
        <rect x="14" y="12" width="4" height="7"/>
      </svg>
    ),
    occupancy: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    alert: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  };
  return icons[type] || icons.buildings;
}

export default function StatsCard({ label, value, sub, accent = false, danger = false, trend = null, icon = null }) {
  const trendColor = trend?.direction === "up" ? "var(--success)" : "var(--danger)";
  const trendArrow = trend?.direction === "up" ? "\u2191" : "\u2193";

  const colorMap = {
    default: { bg: "rgba(0,75,141,.06)", border: "rgba(0,75,141,.1)", icon: "#004B8D", topBorder: "transparent" },
    accent: { bg: "rgba(0,75,141,.06)", border: "rgba(0,75,141,.1)", icon: "#004B8D", topBorder: "#004B8D" },
    danger: { bg: "rgba(192,57,43,.06)", border: "rgba(192,57,43,.1)", icon: "#c0392b", topBorder: "#c0392b" },
  };
  const colors = danger ? colorMap.danger : accent ? colorMap.accent : colorMap.default;
  const valueColor = danger ? "var(--danger)" : accent ? "var(--accent)" : "var(--text-primary)";

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
        borderTop: `3px solid ${colors.topBorder}`,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "var(--shadow)";
        e.currentTarget.style.transform = "";
      }}
    >
      <div className="flex items-start justify-between">
        <p style={{
          fontSize: 11.5,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
        }}>
          {label}
        </p>
        <div
          className="rounded-xl flex items-center justify-center"
          style={{
            width: 38,
            height: 38,
            background: colors.bg,
            color: colors.icon,
          }}
        >
          <StatsIcon type={icon || "buildings"} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <p
          style={{
            fontSize: 34,
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
            className="text-xs font-bold px-2.5 py-1 rounded-full mb-1"
            style={{ background: `${trendColor}15`, color: trendColor }}
          >
            {trendArrow} {trend.pct}%
          </span>
        )}
      </div>
      {sub && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{sub}</p>
      )}
    </div>
  );
}
