function getStatusColor(pct) {
  if (pct > 75) return "var(--danger)";
  if (pct > 40) return "var(--warning)";
  return "var(--success)";
}

function getStatusLabel(pct) {
  if (pct > 75) return "High";
  if (pct > 40) return "Moderate";
  return "Low";
}

export default function BuildingCard({ building, onClick }) {
  const color = getStatusColor(building.current_occupancy_pct);
  const label = getStatusLabel(building.current_occupancy_pct);

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-5 flex flex-col gap-3 cursor-pointer transition-all duration-200"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.06)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.08)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.06)";
        e.currentTarget.style.transform = "";
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            {building.name}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {building.code} &middot; {building.room_count} rooms
          </p>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
        >
          {label}
        </span>
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Occupancy</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{building.current_occupancy_pct}%</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, background: "var(--border)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${building.current_occupancy_pct}%`, background: color }}
          />
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{building.occupied_rooms}</span> of {building.room_count} rooms occupied
      </p>
    </div>
  );
}
