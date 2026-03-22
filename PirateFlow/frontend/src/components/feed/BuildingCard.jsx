function getStatusColor(pct) {
  if (pct > 75) return "#c0392b";
  if (pct > 40) return "#d4881a";
  return "#22875a";
}

function getStatusGradient(pct) {
  if (pct > 75) return "linear-gradient(135deg, #e74c3c, #c0392b)";
  if (pct > 40) return "linear-gradient(135deg, #f0a030, #d4881a)";
  return "linear-gradient(135deg, #2ecc71, #22875a)";
}

function getStatusLabel(pct) {
  if (pct > 75) return "High";
  if (pct > 40) return "Moderate";
  return "Low";
}

export default function BuildingCard({ building, onClick }) {
  const color = getStatusColor(building.current_occupancy_pct);
  const gradient = getStatusGradient(building.current_occupancy_pct);
  const label = getStatusLabel(building.current_occupancy_pct);

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-5 flex flex-col gap-4 cursor-pointer transition-all duration-200"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "var(--shadow)";
        e.currentTarget.style.transform = "";
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className="rounded-xl flex items-center justify-center mt-0.5"
            style={{
              width: 40,
              height: 40,
              background: `${color}10`,
              color: color,
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <path d="M9 22v-4h6v4"/>
              <line x1="8" y1="6" x2="8" y2="6.01"/>
              <line x1="16" y1="6" x2="16" y2="6.01"/>
              <line x1="8" y1="10" x2="8" y2="10.01"/>
              <line x1="16" y1="10" x2="16" y2="10.01"/>
              <line x1="8" y1="14" x2="8" y2="14.01"/>
              <line x1="16" y1="14" x2="16" y2="14.01"/>
            </svg>
          </div>
          <div>
            <p style={{
              fontWeight: 700,
              fontSize: 15.5,
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
              lineHeight: 1.3,
            }}>
              {building.name}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {building.code} &middot; {building.room_count} rooms
            </p>
          </div>
        </div>
        <span
          className="text-xs px-3 py-1.5 rounded-full font-bold"
          style={{
            background: `${color}12`,
            color,
            border: `1px solid ${color}25`,
          }}
        >
          {label}
        </span>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>Occupancy</span>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{building.current_occupancy_pct}%</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 8, background: `${color}10` }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.max(building.current_occupancy_pct, 2)}%`,
              background: gradient,
              boxShadow: building.current_occupancy_pct > 0 ? `0 2px 8px ${color}40` : "none",
            }}
          />
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{building.occupied_rooms || 0}</span> of {building.room_count} rooms occupied
      </p>
    </div>
  );
}
