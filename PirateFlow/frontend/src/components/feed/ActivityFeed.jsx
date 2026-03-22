function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const icons = { occupancy: "\u2B21", booking: "\u25F7", anomaly: "\u25EC" };
const colors = { occupancy: "var(--accent)", booking: "var(--success)", anomaly: "var(--danger)" };

export default function ActivityFeed({ items = [] }) {
  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        height: "100%",
        maxHeight: 460,
        boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.06)",
      }}
    >
      <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          Live Activity
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center" style={{ color: "var(--text-muted)", fontSize: 13 }}>
            No recent activity
          </p>
        ) : (
          items.slice(0, 25).map((item) => (
            <div
              key={item.id}
              className="flex gap-3 px-5 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span style={{ fontSize: 14, color: colors[item.type], marginTop: 1 }}>
                {icons[item.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{item.message}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{timeAgo(item.timestamp)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
