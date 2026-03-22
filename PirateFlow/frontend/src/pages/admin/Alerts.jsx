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
    <div className="admin-card-body">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="admin-card skeleton" />
      ))}
    </div>
  );
}

function AnomalyCard({ anomaly, onDismiss }) {
  const severity = (anomaly.severity || "medium").toLowerCase();
  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium;

  return (
    <div className="admin-card" style={{ borderColor: `${color}44` }}>
      <div className="admin-card-header">
        <div>
          <div className="admin-page-controls">
            <span className="pill" style={{ background: `${color}22`, color }}>
              {severity}
            </span>
            <span className="badge-muted">
              {anomaly.type || anomaly.anomaly_type || "anomaly"}
            </span>
          </div>
          <p className="admin-card-title">
            {anomaly.title || anomaly.message || anomaly.description || "Anomaly detected"}
          </p>
        </div>
        <button
          onClick={() => onDismiss(anomaly.id)}
          className="btn btn-secondary btn-sm"
          title="Dismiss"
        >
          &times;
        </button>
      </div>

      {(anomaly.details || anomaly.description) && anomaly.title && (
        <p className="admin-card-meta">
          {anomaly.details || anomaly.description}
        </p>
      )}

      <div className="admin-card-meta">
        {(anomaly.building || anomaly.building_name || anomaly.location) && (
          <span>{anomaly.building || anomaly.building_name || anomaly.location}</span>
        )}
        {anomaly.room && <span> | Room {anomaly.room}</span>}
        {anomaly.timestamp && (
          <span> | {new Date(anomaly.timestamp).toLocaleString()}</span>
        )}
        {anomaly.confidence != null && (
          <span> | Confidence: {Math.round(anomaly.confidence * 100)}%</span>
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
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Anomaly Alerts</h1>
          <p className="admin-card-meta">
            {anomalies.length} active alert{anomalies.length !== 1 ? "s" : ""}
            {criticalCount > 0 && (
              <span style={{ color: "var(--danger)" }}> — {criticalCount} critical</span>
            )}
            {highCount > 0 && (
              <span style={{ color: "#f97316" }}> — {highCount} high</span>
            )}
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="btn btn-primary"
        >
          {scanning ? "Scanning..." : "Run Detection Scan"}
        </button>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      {/* WebSocket status */}
      <div className="admin-page-controls">
        <span
          className="status-dot"
          style={{ background: ws?.connected ? "var(--success)" : "var(--danger)" }}
        />
        <span className="badge-muted">
          {ws?.connected ? "Live monitoring active" : "WebSocket disconnected — showing last scan results"}
        </span>
      </div>

      {/* Anomaly List */}
      {loading || scanning ? (
        <ScanSkeleton />
      ) : anomalies.length > 0 ? (
        <div className="admin-card-body">
          {anomalies.map((a) => (
            <AnomalyCard key={a.id} anomaly={a} onDismiss={handleDismiss} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>All Clear</h3>
          <p>No anomalies detected. The system is running normally.</p>
        </div>
      )}
    </div>
  );
}
