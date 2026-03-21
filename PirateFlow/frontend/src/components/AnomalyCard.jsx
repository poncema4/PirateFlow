const severityConfig = {
  critical: { color: "var(--danger)", label: "Critical", icon: "◬" },
  warning: { color: "var(--warning)", label: "Warning", icon: "◈" },
  info: { color: "var(--accent)", label: "Info", icon: "◎" },
};

const typeLabels = {
  ghost_booking: "Ghost Booking",
  phantom_usage: "Phantom Usage",
  utilization_spike: "Utilization Spike",
  space_hoarding: "Space Hoarding",
  unusual_pattern: "Unusual Pattern",
};

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Less than 1 hour ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * AnomalyCard
 * Props:
 *   anomaly  — Anomaly object (see interfaces.ts)
 *   onDismiss — (id: string) => void
 *   isNew    — boolean, triggers slide-in animation
 */
export default function AnomalyCard({ anomaly, onDismiss, isNew = false }) {
  const sev = severityConfig[anomaly.severity];

  return (
    <div
      className="rounded-xl p-5 transition-all duration-500"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${sev.color}44`,
        borderLeft: `4px solid ${sev.color}`,
        animation: isNew ? "slideIn 0.4s ease-out" : "none",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <span style={{ fontSize: "20px", color: sev.color, marginTop: 2 }}>{sev.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: `${sev.color}22`, color: sev.color }}
              >
                {sev.label}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}
              >
                {typeLabels[anomaly.type]}
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {anomaly.room_name} · {anomaly.building_name}
              </span>
            </div>

            <p style={{ fontSize: "14px", color: "var(--text-primary)", marginBottom: 6, lineHeight: 1.5 }}>
              {anomaly.description}
            </p>

            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>→ </span>
              {anomaly.recommended_action}
            </p>

            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 8 }}>
              Detected {timeAgo(anomaly.detected_at)}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={() => onDismiss(anomaly.id)}
            className="text-sm px-3 py-1 rounded-lg transition-all"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              cursor: "pointer",
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--danger)";
              e.currentTarget.style.color = "var(--danger)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}