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
      className="rounded-sm"
      style={{ width: 18, height: 18, background: bg, cursor: "default" }}
    />
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }}>
      <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{label}</p>
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

  const btnStyle = (active) => ({
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "var(--accent)22" : "transparent",
    color: active ? "var(--accent)" : "var(--text-muted)",
    cursor: "pointer",
  });

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
          Utilization Analytics
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding(e.target.value)}
            className="rounded-lg px-2 py-1"
            style={{ fontSize: 11, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            <option value="all">All Buildings</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {TIME_RANGES.map((tr) => (
            <button key={tr.key} onClick={() => setTimeRange(tr.key)} style={btnStyle(timeRange === tr.key)}>
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--danger)22", color: "var(--danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Utilization Trend */}
      {loadingUtil ? (
        <ChartSkeleton height={220} />
      ) : trendData.length > 0 ? (
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-3" style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            Utilization Trend
          </p>
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
        <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No utilization data available for this range</p>
        </div>
      )}

      {/* Building Breakdown */}
      {buildingBreakdown.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-3" style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            By Building
          </p>
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
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-3" style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            Usage Heatmap
          </p>
          <div className="overflow-x-auto">
            <div className="flex flex-col gap-1" style={{ minWidth: 360 }}>
              {/* Hour labels */}
              <div className="flex gap-1 ml-10">
                {heatmapGrid.hours.map((h) => (
                  <div key={h} style={{ width: 18, textAlign: "center", fontSize: 8, color: "var(--text-muted)" }}>
                    {h}
                  </div>
                ))}
              </div>
              {heatmapGrid.grid.map((row, di) => (
                <div key={di} className="flex items-center gap-1">
                  <span style={{ width: 36, fontSize: 9, color: "var(--text-muted)", textAlign: "right", marginRight: 4 }}>
                    {heatmapGrid.days[di] || `D${di}`}
                  </span>
                  {(Array.isArray(row) ? row : []).map((val, hi) => (
                    <HeatmapCell key={hi} value={val} hour={heatmapGrid.hours[hi]} day={heatmapGrid.days[di]} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Low</span>
            <div className="flex gap-0.5">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                <div key={v} className="rounded-sm" style={{ width: 14, height: 10, background: `rgba(0, 230, 180, ${v})` }} />
              ))}
            </div>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>High</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Heatmap data unavailable</p>
        </div>
      )}

      {/* Predictive Analytics */}
      <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>Predictive Analytics</p>
          <button
            onClick={handlePredict}
            disabled={loadingPrediction}
            className="rounded-lg px-3 py-1.5"
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: "var(--accent)",
              color: "var(--bg-primary)",
              border: "none",
              cursor: loadingPrediction ? "wait" : "pointer",
              opacity: loadingPrediction ? 0.6 : 1,
            }}
          >
            {loadingPrediction ? "Forecasting..." : "Generate Forecast"}
          </button>
        </div>
        {prediction ? (
          <div className="flex flex-col gap-3">
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
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{prediction.summary}</p>
            )}
            {prediction.insights?.map((ins, i) => (
              <p key={i} style={{ fontSize: 11, color: "var(--text-muted)" }}>&bull; {ins}</p>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Click forecast to generate AI-powered utilization predictions
          </p>
        )}
      </div>
    </div>
  );
}
