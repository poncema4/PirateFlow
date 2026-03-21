import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { api } from "../api/client";
import { ChartSkeleton } from "../components/LoadingSkeleton";

const BUILDING_COLORS = ["var(--accent)", "var(--warning)", "var(--danger)", "#7c6af7", "#00bfff", "#ff69b4"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 12 }, (_, i) => `${i + 8}:00`);

function HeatmapCell({ value }) {
  const pct = typeof value === "number" ? value : Math.round((value || 0) * 100);
  const opacity = pct / 100;
  const bg = `rgba(0, 200, 150, ${0.08 + opacity * 0.92})`;
  return (
    <div
      className="rounded flex items-center justify-center cursor-pointer transition-all"
      style={{ background: bg, color: pct > 55 ? "#000" : "var(--text-muted)", fontSize: "10px", height: 28 }}
      title={`${pct}% utilization`}
    >
      {pct}%
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) =>
        p.value != null ? (
          <p key={i} style={{ fontSize: 13, color: p.color, fontWeight: 600 }}>
            {p.name}: {p.value}%
          </p>
        ) : null
      )}
    </div>
  );
};

export default function Analytics() {
  const [range, setRange] = useState("7d");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [buildings, setBuildings] = useState([]);

  // Real data states
  const [utilizationData, setUtilizationData] = useState([]);
  const [heatmapRaw, setHeatmapRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heatmapLoading, setHeatmapLoading] = useState(true);

  // Forecast states
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [forecastData, setForecastData] = useState([]);
  const [forecastCards, setForecastCards] = useState([]);

  // Load buildings for filter dropdown
  useEffect(() => {
    api.getBuildings().then(setBuildings).catch(() => {});
  }, []);

  // Load utilization data when range or building changes
  useEffect(() => {
    setLoading(true);
    const days_map = { "7d": 7, "30d": 30, "semester": 120 };
    const params = { days: days_map[range] };
    if (buildingFilter !== "all") params.building_id = buildingFilter;

    api.getUtilization ? 
      api.getUtilization(params)
        .then(data => {
          // API returns array of { period, utilization_pct }
          const normalized = (Array.isArray(data) ? data : data.data || []).map(d => ({
            period: d.period || d.date,
            utilization_pct: typeof d.utilization_pct === "number"
              ? Math.round(d.utilization_pct > 1 ? d.utilization_pct : d.utilization_pct * 100)
              : d.utilization_pct,
          }));
          setUtilizationData(normalized);
        })
        .catch(() => setUtilizationData([]))
        .finally(() => setLoading(false))
      : fetch(`/api/analytics/utilization?days=${days_map[range]}${buildingFilter !== "all" ? `&building_id=${buildingFilter}` : ""}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("pf_access")}` }
        })
        .then(r => r.json())
        .then(data => {
          const arr = Array.isArray(data) ? data : data.data || [];
          setUtilizationData(arr.map(d => ({
            period: d.period || d.date,
            utilization_pct: typeof d.utilization_pct === "number"
              ? Math.round(d.utilization_pct > 1 ? d.utilization_pct : d.utilization_pct * 100)
              : 0,
          })));
        })
        .catch(() => setUtilizationData([]))
        .finally(() => setLoading(false));
  }, [range, buildingFilter]);

  // Load heatmap data
  useEffect(() => {
    setHeatmapLoading(true);
    fetch("/api/analytics/utilization/heatmap", {
      headers: { Authorization: `Bearer ${localStorage.getItem("pf_access")}` }
    })
      .then(r => r.json())
      .then(data => setHeatmapRaw(Array.isArray(data) ? data : data.data || []))
      .catch(() => setHeatmapRaw([]))
      .finally(() => setHeatmapLoading(false));
  }, []);

  // Build heatmap grid from API data
  const heatmap = useMemo(() => {
    return days.map((day) =>
      hours.map((_, hi) => {
        const hour = hi + 8;
        const found = heatmapRaw.find(d =>
          (d.day_of_week === day || d.day === day) && (d.hour === hour || d.hour_of_day === hour)
        );
        if (!found) return 0;
        const val = found.utilization_pct ?? found.avg_utilization ?? found.value ?? 0;
        return Math.round(val > 1 ? val : val * 100);
      })
    );
  }, [heatmapRaw]);

  const handleForecast = async () => {
    setLoadingForecast(true);
    setShowForecast(false);
    try {
      const res = await fetch("/api/ai/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("pf_access")}`,
        },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await res.json();
      const predictions = Array.isArray(data) ? data : data.predictions || data.data || [];

      // Merge actuals + predictions into one chart dataset
      const merged = [
        ...utilizationData.map(d => ({ ...d, predicted_pct: null })),
        ...predictions.map(p => ({
          period: p.period || p.date,
          utilization_pct: null,
          predicted_pct: Math.round((p.predicted_pct || p.utilization_pct || 0) > 1
            ? (p.predicted_pct || p.utilization_pct)
            : (p.predicted_pct || p.utilization_pct) * 100),
        })),
      ];
      setForecastData(merged);

      // Build forecast summary cards
      if (predictions.length > 0) {
        const peak = predictions.reduce((a, b) =>
          (b.predicted_pct || 0) > (a.predicted_pct || 0) ? b : a, predictions[0]);
        const low = predictions.reduce((a, b) =>
          (b.predicted_pct || 0) < (a.predicted_pct || 0) ? b : a, predictions[0]);
        setForecastCards([
          { label: "Predicted Peak", value: `${Math.round((peak.predicted_pct || 0) > 1 ? peak.predicted_pct : peak.predicted_pct * 100)}%`, sub: peak.period || "", icon: "◈", color: "var(--warning)" },
          { label: "Highest Risk Day", value: peak.period || "", sub: "Highest predicted utilization", icon: "◬", color: "var(--danger)" },
          { label: "Best Window", value: low.period || "", sub: "Lowest predicted utilization", icon: "◎", color: "var(--accent)" },
        ]);
      }
      setShowForecast(true);
    } catch {
      // Fallback to static forecast cards if API fails
      setForecastData([...utilizationData.map(d => ({ ...d, predicted_pct: null }))]);
      setForecastCards([
        { label: "Tomorrow's Predicted Peak", value: "85%", sub: "AI prediction unavailable — showing estimate", icon: "◈", color: "var(--warning)" },
      ]);
      setShowForecast(true);
    } finally {
      setLoadingForecast(false);
    }
  };

  const selectedBuilding = buildings.find(b => b.id === buildingFilter);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {["7d", "30d", "semester"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                background: range === r ? "var(--accent)" : "var(--bg-card)",
                color: range === r ? "#000" : "var(--text-muted)",
                border: "1px solid var(--border)",
                fontWeight: range === r ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {r === "7d" ? "Last 7 Days" : r === "30d" ? "Last 30 Days" : "This Semester"}
            </button>
          ))}
        </div>
        <select
          value={buildingFilter}
          onChange={e => setBuildingFilter(e.target.value)}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            color: "var(--text-primary)", borderRadius: 8, padding: "6px 12px",
            fontSize: "13px", cursor: "pointer", outline: "none",
          }}
        >
          <option value="all">All Buildings</option>
          {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Utilization chart */}
      {loading ? <ChartSkeleton height={260} /> : (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
            Utilization Over Time
            {selectedBuilding && <span style={{ color: "var(--accent)", marginLeft: 8, fontWeight: 400, fontSize: "13px" }}>— {selectedBuilding.name}</span>}
          </p>
          {utilizationData.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>No utilization data available for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fill: "var(--text-muted)", fontSize: 12 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="utilization_pct" stroke="var(--accent)" strokeWidth={2.5}
                  dot={{ fill: "var(--accent)", r: 4 }} activeDot={{ r: 6 }} name="Utilization" isAnimationActive connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Predictive Analytics */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>🤖 Predictive Analytics</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>AI-powered 7-day utilization forecast</p>
          </div>
          <button
            onClick={handleForecast}
            disabled={loadingForecast}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: loadingForecast ? "var(--bg-card)" : "var(--accent)",
              color: loadingForecast ? "var(--text-muted)" : "#000",
              border: "1px solid var(--border)",
              cursor: loadingForecast ? "not-allowed" : "pointer",
            }}
          >
            {loadingForecast ? "Generating..." : showForecast ? "↻ Refresh" : "Generate Forecast"}
          </button>
        </div>

        {loadingForecast ? (
          <div className="flex flex-col gap-3">
            <div style={{ height: 200, borderRadius: 8, background: "var(--border)", animation: "shimmer 1.5s ease-in-out infinite" }} />
          </div>
        ) : showForecast ? (
          <div className="flex flex-col gap-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="utilization_pct" stroke="var(--accent)" strokeWidth={2.5}
                  dot={{ fill: "var(--accent)", r: 4 }} name="Actual" connectNulls={false} isAnimationActive />
                <Line type="monotone" dataKey="predicted_pct" stroke="var(--warning)" strokeWidth={2}
                  strokeDasharray="6 3" dot={{ fill: "var(--warning)", r: 3 }} name="Predicted" connectNulls={false} isAnimationActive />
                <Legend formatter={v => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v}</span>} />
              </LineChart>
            </ResponsiveContainer>
            {forecastCards.length > 0 && (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${forecastCards.length}, 1fr)` }}>
                {forecastCards.map((card, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: "var(--bg-primary)", border: `1px solid ${card.color}44` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ color: card.color, fontSize: 16 }}>{card.icon}</span>
                      <p style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{card.label}</p>
                    </div>
                    <p style={{ fontSize: "24px", fontWeight: 800, color: card.color, fontFamily: "var(--font-display)", lineHeight: 1 }}>{card.value}</p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 4 }}>{card.sub}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12" style={{ border: "1px dashed var(--border)", borderRadius: 8 }}>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Click "Generate Forecast" to run AI prediction</p>
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>Usage Heatmap — Hour × Day</p>
        {heatmapLoading ? <ChartSkeleton height={220} /> : (
          <div style={{ overflowX: "auto" }}>
            <div className="grid mb-1" style={{ gridTemplateColumns: `60px repeat(12, 1fr)`, gap: 3, minWidth: 600 }}>
              <div />
              {hours.map(h => <div key={h} style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center" }}>{h}</div>)}
            </div>
            {days.map((day, di) => (
              <div key={day} className="grid mb-1" style={{ gridTemplateColumns: `60px repeat(12, 1fr)`, gap: 3, minWidth: 600 }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{day}</div>
                {heatmap[di].map((val, hi) => <HeatmapCell key={hi} value={val} />)}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-4">
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Low</span>
              <div style={{ height: 8, flex: 1, borderRadius: 4, background: "linear-gradient(90deg, rgba(0,200,150,0.08), rgba(0,200,150,1))" }} />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>High</span>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}