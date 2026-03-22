import { useEffect, useState, useMemo } from "react";
import { api } from "../../api/client";
import { ChartSkeleton } from "../../components/common/LoadingSkeleton";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const TIME_RANGES = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "semester", label: "Semester" },
];

function HeatmapCell({ value, hour, day }) {
  const intensity = Math.min(value / 100, 1);
  const bg = `rgba(0, 230, 180, ${intensity * 0.85 + 0.05})`;
  return (
    <div
      title={`${day} ${hour}:00 — ${Math.round(value)}%`}
      className="heatmap-cell"
      style={{ background: bg }}
    />
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}%
        </p>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState("all");
  const [timeRange, setTimeRange] = useState("7d");
  const [utilization, setUtilization] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loadingUtil, setLoadingUtil] = useState(true);
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [error, setError] = useState(null);

  // Load buildings
  useEffect(() => {
    api.getBuildings()
      .then((d) => setBuildings(Array.isArray(d) ? d : d.buildings || []))
      .catch(() => {});
  }, []);

  // Load utilization
  useEffect(() => {
    setLoadingUtil(true);
    const params = { time_range: timeRange };
    if (selectedBuilding !== "all") params.building_id = selectedBuilding;
    api.getUtilization(params)
      .then((d) => setUtilization(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingUtil(false));
  }, [timeRange, selectedBuilding]);

  // Load heatmap
  useEffect(() => {
    setLoadingHeatmap(true);
    api.getHeatmap()
      .then((d) => setHeatmap(d))
      .catch(() => {})
      .finally(() => setLoadingHeatmap(false));
  }, []);

  const handlePredict = async () => {
    setLoadingPrediction(true);
    try {
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const data = await api.predict(days);
      setPrediction(data);
    } catch {
      setPrediction(null);
    } finally {
      setLoadingPrediction(false);
    }
  };

  // Normalize utilization trend data
  const trendData = useMemo(() => {
    if (!utilization) return [];
    const raw = utilization.trend || utilization.daily || utilization.data || [];
    return raw.map((d) => ({
      ...d,
      date: d.date || d.day || d.label,
      utilization: d.utilization ?? d.avg_utilization ?? d.value ?? 0,
      peak: d.peak ?? d.peak_utilization ?? null,
    }));
  }, [utilization]);

  // By-building breakdown
  const buildingBreakdown = useMemo(() => {
    if (!utilization?.by_building) return [];
    return utilization.by_building.map((b) => ({
      name: b.name || b.building_name || b.building_id,
      utilization: b.avg_utilization ?? b.utilization ?? 0,
    }));
  }, [utilization]);

  // Heatmap grid
  const heatmapGrid = useMemo(() => {
    if (!heatmap) return null;
    const grid = heatmap.grid || heatmap.data || heatmap.heatmap;
    if (!grid) return null;
    const days = heatmap.days || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const hours = heatmap.hours || Array.from({ length: 16 }, (_, i) => i + 6);
    return { grid, days, hours };
  }, [heatmap]);

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Utilization Analytics</h1>
        <div className="admin-page-controls">
          <select
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding(e.target.value)}
            className="form-select"
          >
            <option value="all">All Buildings</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.key}
              onClick={() => setTimeRange(tr.key)}
              className={`filter-btn ${timeRange === tr.key ? "active" : ""}`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      {/* Utilization Trend */}
      {loadingUtil ? (
        <ChartSkeleton height={220} />
      ) : trendData.length > 0 ? (
        <div className="chart-card">
          <p className="chart-card-title">Utilization Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="utilization" stroke="var(--accent)" strokeWidth={2} dot={false} name="Avg Utilization" />
              {trendData[0]?.peak != null && (
                <Line type="monotone" dataKey="peak" stroke="var(--warning)" strokeWidth={1.5} dot={false} name="Peak" strokeDasharray="4 4" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-state">
          <p>No utilization data available for this range</p>
        </div>
      )}

      {/* Building Breakdown */}
      {buildingBreakdown.length > 0 && (
        <div className="chart-card">
          <p className="chart-card-title">By Building</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={buildingBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="utilization" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Utilization" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Heatmap */}
      {loadingHeatmap ? (
        <ChartSkeleton height={180} />
      ) : heatmapGrid ? (
        <div className="chart-card">
          <p className="chart-card-title">Usage Heatmap</p>
          <div className="heatmap-scroll">
            <div className="heatmap-grid">
              {/* Hour labels */}
              <div className="heatmap-hour-labels">
                {heatmapGrid.hours.map((h) => (
                  <span key={h} className="heatmap-hour-label">{h}</span>
                ))}
              </div>
              {heatmapGrid.grid.map((row, di) => (
                <div key={di} className="heatmap-row">
                  <span className="heatmap-day-label">
                    {heatmapGrid.days[di] || `D${di}`}
                  </span>
                  {(Array.isArray(row) ? row : []).map((val, hi) => (
                    <HeatmapCell key={hi} value={val} hour={heatmapGrid.hours[hi]} day={heatmapGrid.days[di]} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="heatmap-legend">
            <span className="heatmap-legend-label">Low</span>
            <div className="heatmap-legend-bar">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                <div key={v} className="heatmap-legend-swatch" style={{ background: `rgba(0, 230, 180, ${v})` }} />
              ))}
            </div>
            <span className="heatmap-legend-label">High</span>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>Heatmap data unavailable</p>
        </div>
      )}

      {/* Predictive Analytics */}
      <div className="chart-card">
        <div className="admin-page-header">
          <p className="chart-card-title">Predictive Analytics</p>
          <button
            onClick={handlePredict}
            disabled={loadingPrediction}
            className="btn btn-primary btn-sm"
          >
            {loadingPrediction ? "Forecasting..." : "Generate Forecast"}
          </button>
        </div>
        {prediction ? (
          <div className="admin-card-body">
            {prediction.forecast && (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={prediction.forecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="predicted" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Predicted" />
                </LineChart>
              </ResponsiveContainer>
            )}
            {prediction.summary && (
              <p className="admin-card-meta">{prediction.summary}</p>
            )}
            {prediction.insights?.map((ins, i) => (
              <p key={i} className="admin-card-meta">&bull; {ins}</p>
            ))}
          </div>
        ) : (
          <p className="admin-card-meta">
            Click forecast to generate AI-powered utilization predictions
          </p>
        )}
      </div>
    </div>
  );
}
