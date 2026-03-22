function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const typeConfig = {
  occupancy: {
    color: "#2563eb",
    bg: "rgba(37,99,235,.08)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
      </svg>
    ),
  },
  booking: {
    color: "#16a34a",
    bg: "rgba(22,163,74,.08)",
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
    color: "#dc2626",
    bg: "rgba(220,38,38,.08)",
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
    <div className="activity-feed">
      <div className="activity-feed-header">
        <div className="activity-feed-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <p className="activity-feed-title">Live Activity</p>
      </div>

      <div className="activity-feed-list">
        {items.length === 0 ? (
          <div className="activity-feed-empty">
            <div className="activity-feed-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <p className="activity-feed-empty-title">No recent activity</p>
            <p className="activity-feed-empty-sub">Activity will appear here as events occur</p>
          </div>
        ) : (
          items.slice(0, 25).map((item) => {
            const config = typeConfig[item.type] || typeConfig.occupancy;
            return (
              <div key={item.id} className="activity-feed-item">
                <div
                  className="activity-feed-item-icon"
                  style={{ background: config.bg, color: config.color }}
                >
                  {config.icon}
                </div>
                <div className="activity-feed-item-content">
                  <p className="activity-feed-item-msg">{item.message}</p>
                  <p className="activity-feed-item-time">{timeAgo(item.timestamp)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
