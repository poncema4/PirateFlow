import { useState, useEffect } from "react";
import { mockAnomalies } from "../api/mockData";

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

function AnomalyCard({ anomaly, onDismiss, isNew }) {
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
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: `${sev.color}22`, color: sev.color }}>
                {sev.label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--border)", color: "var(--text-muted)" }}>
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
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--danger)"; e.currentTarget.style.color = "var(--danger)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ScanSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex gap-3">
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--border)", animation: "shimmer 1.5s ease-in-out infinite" }} />
            <div className="flex-1 flex flex-col gap-2">
              <div style={{ height: 12, width: "40%", borderRadius: 6, background: "var(--border)", animation: "shimmer 1.5s ease-in-out infinite" }} />
              <div style={{ height: 12, width: "80%", borderRadius: 6, background: "var(--border)", animation: "shimmer 1.5s ease-in-out infinite" }} />
              <div style={{ height: 12, width: "60%", borderRadius: 6, background: "var(--border)", animation: "shimmer 1.5s ease-in-out infinite" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Alerts() {
  const [anomalies, setAnomalies] = useState(mockAnomalies);
  const [scanning, setScanning] = useState(false);
  const [newIds, setNewIds] = useState(new Set());

  const dismiss = (id) => setAnomalies(prev => prev.filter(a => a.id !== id));

  const scan = async () => {
    setScanning(true);
    // Replace with: const res = await apiClient.post("/ai/anomalies");
    await new Promise(r => setTimeout(r, 2500));

    // Simulate a new anomaly arriving
    const newAnomaly = {
      id: String(Date.now()),
      type: "unusual_pattern",
      severity: "warning",
      room_id: "r99",
      room_name: "Room 105",
      building_name: "McNulty Hall",
      description: "Occupancy sensor shows repeated 2-minute check-ins suggesting badge-tap abuse to hold the space without actual usage.",
      recommended_action: "Implement a minimum 15-minute occupancy threshold before space is marked as reserved.",
      detected_at: new Date().toISOString(),
    };
    setAnomalies(prev => [newAnomaly, ...prev]);
    setNewIds(prev => new Set([...prev, newAnomaly.id]));
    setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(newAnomaly.id); return n; }), 2000);
    setScanning(false);
  };

  const sorted = [...anomalies].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {anomalies.length} anomalies detected
          </span>
          {anomalies.filter(a => a.severity === "critical").length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "var(--danger)", color: "#fff" }}>
              {anomalies.filter(a => a.severity === "critical").length} critical
            </span>
          )}
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: scanning ? "var(--bg-card)" : "var(--accent)",
            color: scanning ? "var(--text-muted)" : "#000",
            border: "1px solid var(--border)",
            cursor: scanning ? "not-allowed" : "pointer",
          }}
        >
          {scanning ? "⟳ Scanning..." : "⟳ Scan for Anomalies"}
        </button>
      </div>

      {/* Cards or skeleton */}
      {scanning ? (
        <div>
          <p className="mb-3" style={{ fontSize: "13px", color: "var(--accent)" }}>
            AI is analyzing campus data...
          </p>
          <ScanSkeleton />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: "32px", marginBottom: 8 }}>✓</p>
          <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>No anomalies detected</p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: 4 }}>Campus is running normally</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map(a => (
            <AnomalyCard key={a.id} anomaly={a} onDismiss={dismiss} isNew={newIds.has(a.id)} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}