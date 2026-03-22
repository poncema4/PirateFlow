import { useEffect, useState, useCallback } from "react";
import { api } from "../../api/client";
import { useWebSocket } from "../../context/WebSocketContext";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_COLORS = {
  critical: "var(--danger)",
  high: "#f97316",
  medium: "var(--warning)",
  low: "var(--text-muted)",
};

function ScanSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-4 flex flex-col gap-2"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex justify-between">
            <div
              className="rounded"
              style={{
                width: 180,
                height: 14,
                background: "var(--border)",
                animation: "shimmer 1.5s ease-in-out infinite",
                backgroundImage: "linear-gradient(90deg, var(--border) 25%, #1e2a2a 50%, var(--border) 75%)",
                backgroundSize: "200% 100%",
              }}
            />
            <div
              className="rounded-full"
              style={{
                width: 50,
                height: 18,
                background: "var(--border)",
                animation: "shimmer 1.5s ease-in-out infinite",
                backgroundImage: "linear-gradient(90deg, var(--border) 25%, #1e2a2a 50%, var(--border) 75%)",
                backgroundSize: "200% 100%",
              }}
            />
          </div>
          <div
            className="rounded"
            style={{
              width: "70%",
              height: 10,
              background: "var(--border)",
              animation: "shimmer 1.5s ease-in-out infinite",
              backgroundImage: "linear-gradient(90deg, var(--border) 25%, #1e2a2a 50%, var(--border) 75%)",
              backgroundSize: "200% 100%",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function AnomalyCard({ anomaly, onDismiss }) {
  const severity = (anomaly.severity || "medium").toLowerCase();
  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium;

  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-2"
      style={{ background: "var(--bg-card)", border: `1px solid ${color}44` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold uppercase"
              style={{ background: `${color}22`, color, fontSize: 9, letterSpacing: "0.05em" }}
            >
              {severity}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {anomaly.type || anomaly.anomaly_type || "anomaly"}
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
            {anomaly.title || anomaly.message || anomaly.description || "Anomaly detected"}
          </p>
        </div>
        <button
          onClick={() => onDismiss(anomaly.id)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
          }}
          title="Dismiss"
        >
          &times;
        </button>
      </div>

      {(anomaly.details || anomaly.description) && anomaly.title && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {anomaly.details || anomaly.description}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 10, color: "var(--text-muted)" }}>
        {(anomaly.building || anomaly.building_name || anomaly.location) && (
          <span>{anomaly.building || anomaly.building_name || anomaly.location}</span>
        )}
        {anomaly.room && <span>Room {anomaly.room}</span>}
        {anomaly.timestamp && (
          <span>{new Date(anomaly.timestamp).toLocaleString()}</span>
        )}
        {anomaly.confidence != null && (
          <span>Confidence: {Math.round(anomaly.confidence * 100)}%</span>
        )}
      </div>
    </div>
  );
}

export default function Alerts() {
  const ws = useWebSocket();
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  const loadAnomalies = useCallback(async () => {
    try {
      const data = await api.detectAnomalies();
      const list = data.anomalies || data.alerts || (Array.isArray(data) ? data : []);
      setAnomalies(
        list
          .map((a, i) => ({ ...a, id: a.id || `anomaly-${i}-${Date.now()}` }))
          .sort((a, b) => (SEVERITY_ORDER[a.severity?.toLowerCase()] ?? 3) - (SEVERITY_ORDER[b.severity?.toLowerCase()] ?? 3))
      );
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadAnomalies().finally(() => setLoading(false));
  }, [loadAnomalies]);

  // WebSocket listeners
  useEffect(() => {
    if (!ws) return;
    const handleAlert = (data) => {
      const newAnomaly = {
        ...data,
        id: data.id || `ws-${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setAnomalies((prev) =>
        [newAnomaly, ...prev].sort(
          (a, b) => (SEVERITY_ORDER[a.severity?.toLowerCase()] ?? 3) - (SEVERITY_ORDER[b.severity?.toLowerCase()] ?? 3)
        )
      );
    };

    ws.on("access_alert", handleAlert);
    ws.on("anomaly_alert", handleAlert);
    return () => {
      ws.off("access_alert", handleAlert);
      ws.off("anomaly_alert", handleAlert);
    };
  }, [ws]);

  const handleScan = async () => {
    setScanning(true);
    await loadAnomalies();
    setScanning(false);
  };

  const handleDismiss = (id) => {
    setAnomalies((prev) => prev.filter((a) => a.id !== id));
  };

  const criticalCount = anomalies.filter((a) => a.severity?.toLowerCase() === "critical").length;
  const highCount = anomalies.filter((a) => a.severity?.toLowerCase() === "high").length;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
            Anomaly Alerts
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {anomalies.length} active alert{anomalies.length !== 1 ? "s" : ""}
            {criticalCount > 0 && (
              <span style={{ color: "var(--danger)", fontWeight: 700 }}> — {criticalCount} critical</span>
            )}
            {highCount > 0 && (
              <span style={{ color: "#f97316", fontWeight: 700 }}> — {highCount} high</span>
            )}
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="rounded-lg px-4 py-2"
          style={{
            fontSize: 12,
            fontWeight: 700,
            background: "var(--accent)",
            color: "var(--bg-primary)",
            border: "none",
            cursor: scanning ? "wait" : "pointer",
            opacity: scanning ? 0.6 : 1,
          }}
        >
          {scanning ? "Scanning..." : "Run Detection Scan"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--danger)22", color: "var(--danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* WebSocket status */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block rounded-full"
          style={{ width: 6, height: 6, background: ws?.connected ? "var(--success)" : "var(--danger)" }}
        />
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {ws?.connected ? "Live monitoring active" : "WebSocket disconnected — showing last scan results"}
        </span>
      </div>

      {/* Anomaly List */}
      {loading || scanning ? (
        <ScanSkeleton />
      ) : anomalies.length > 0 ? (
        <div className="flex flex-col gap-3">
          {anomalies.map((a) => (
            <AnomalyCard key={a.id} anomaly={a} onDismiss={handleDismiss} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl p-10 text-center flex flex-col items-center gap-2"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <span style={{ fontSize: 28 }}>&#10003;</span>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>All Clear</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            No anomalies detected. The system is running normally.
          </p>
        </div>
      )}
    </div>
  );
}
