function getStatusColor(pct) {
  if (pct > 75) return "#dc2626";
  if (pct > 40) return "#ea580c";
  return "#16a34a";
}

function getStatusGradient(pct) {
  if (pct > 75) return "linear-gradient(135deg, #ef4444, #dc2626)";
  if (pct > 40) return "linear-gradient(135deg, #f97316, #ea580c)";
  return "linear-gradient(135deg, #22c55e, #16a34a)";
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
    <div onClick={onClick} className="building-card">
      <div className="building-card-header">
        <div className="building-card-info">
          <div
            className="building-card-icon"
            style={{ background: `${color}10`, color }}
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
            <p className="building-card-name">{building.name}</p>
            <p className="building-card-meta">{building.code} &middot; {building.room_count} rooms</p>
          </div>
        </div>
        <span
          className="building-card-status"
          style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}
        >
          {label}
        </span>
      </div>

      <div className="building-card-occupancy">
        <span className="building-card-occ-label">Occupancy</span>
        <span className="building-card-occ-value" style={{ color }}>{building.current_occupancy_pct}%</span>
      </div>
      <div className="building-card-bar" style={{ background: `${color}10` }}>
        <div
          className="building-card-bar-fill"
          style={{
            width: `${Math.max(building.current_occupancy_pct, 2)}%`,
            background: gradient,
          }}
        />
      </div>

      <p className="building-card-rooms">
        <strong>{building.occupied_rooms || 0}</strong> of {building.room_count} rooms occupied
      </p>
    </div>
  );
}
