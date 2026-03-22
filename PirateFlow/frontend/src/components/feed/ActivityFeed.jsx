function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const typeConfig = {
  occupancy: {
    color: "#004B8D",
    bg: "rgba(0,75,141,.08)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
      </svg>
    ),
  },
  booking: {
    color: "#22875a",
    bg: "rgba(34,135,90,.08)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  anomaly: {
    color: "#c0392b",
    bg: "rgba(192,57,43,.08)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
};

export default function ActivityFeed({ items = [] }) {
  return (
    <div
      className="rounded-2xl flex flex-col"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        height: "100%",
        maxHeight: 520,
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 py-4 flex items-center gap-2.5"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(135deg, rgba(0,75,141,.03), rgba(0,75,141,.01))",
        }}
      >
        <div
          className="rounded-lg flex items-center justify-center"
          style={{
            width: 30,
            height: 30,
            background: "rgba(0,75,141,.08)",
            color: "#004B8D",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <p style={{
          fontWeight: 700,
          fontSize: 15,
          color: "var(--text-primary)",
          fontFamily: "var(--font-display)",
        }}>
          Live Activity
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6" style={{ color: "var(--text-muted)" }}>
            <div
              className="rounded-2xl flex items-center justify-center mb-4"
              style={{
                width: 56,
                height: 56,
                background: "rgba(0,75,141,.05)",
                color: "rgba(0,75,141,.25)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No recent activity</p>
            <p style={{ fontSize: 12, opacity: .7, textAlign: "center" }}>
              Activity will appear here as events occur
            </p>
          </div>
        ) : (
          items.slice(0, 25).map((item) => {
            const config = typeConfig[item.type] || typeConfig.occupancy;
            return (
              <div
                key={item.id}
                className="flex gap-3 px-5 py-3.5 transition-colors duration-150"
                style={{ borderBottom: "1px solid rgba(0,0,0,.04)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(0,75,141,.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div
                  className="rounded-lg flex items-center justify-center mt-0.5"
                  style={{
                    width: 30,
                    height: 30,
                    background: config.bg,
                    color: config.color,
                    flexShrink: 0,
                  }}
                >
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{
                    fontSize: 13,
                    color: "var(--text-primary)",
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}>
                    {item.message}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    {timeAgo(item.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
