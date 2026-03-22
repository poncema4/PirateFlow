const severityConfig = {
  critical: { color: "var(--danger)", label: "Critical", icon: "\u25EC" },
  warning: { color: "var(--warning)", label: "Warning", icon: "\u25C8" },
  info: { color: "var(--accent)", label: "Info", icon: "\u25CE" },
};

const typeLabels = {
  ghost_booking: "Ghost Booking",
  phantom_usage: "Phantom Usage",
  utilization_spike: "Utilization Spike",
  space_hoarding: "Space Hoarding",
  unusual_pattern: "Unusual Pattern",
  unauthorized_access: "Unauthorized Access",
};

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Less than 1 hour ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AnomalyCard({ anomaly, onDismiss, isNew = false }) {
  const sev = severityConfig[anomaly.severity] || severityConfig.info;

  return (
    <div
      className="anomaly-card"
      style={{
        borderColor: `${sev.color}44`,
        borderLeftColor: sev.color,
        animation: isNew ? "slideIn 0.4s ease-out" : "none",
      }}
    >
      <div className="anomaly-card-body">
        <div className="anomaly-card-content">
          <span className="anomaly-card-icon" style={{ color: sev.color }}>{sev.icon}</span>
          <div className="anomaly-card-detail">
            <div className="anomaly-card-meta">
              <span
                className="pill"
                style={{ background: `${sev.color}22`, color: sev.color }}
              >
                {sev.label}
              </span>
              <span className="pill pill--outline">
                {typeLabels[anomaly.type] || anomaly.type || "Anomaly"}
              </span>
              {(anomaly.room_name || anomaly.building_name) && (
                <span className="anomaly-card-location">
                  {anomaly.room_name}{anomaly.room_name && anomaly.building_name ? " \u00B7 " : ""}{anomaly.building_name}
                </span>
              )}
            </div>

            <p className="anomaly-card-desc">
              {anomaly.description}
            </p>

            {anomaly.recommended_action && (
              <p className="anomaly-card-action">
                <span>&rarr; </span>
                {anomaly.recommended_action}
              </p>
            )}

            <p className="anomaly-card-time">
              Detected {timeAgo(anomaly.detected_at || anomaly.created_at || new Date().toISOString())}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={() => onDismiss(anomaly.id)}
            className="anomaly-dismiss-btn"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
