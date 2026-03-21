import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { mockUtilizationData, mockHeatmapData, mockBuildings } from "../api/mockData";
import { ChartSkeleton } from "../components/LoadingSkeleton";

const BUILDING_COLORS = ["var(--accent)", "var(--warning)", "var(--danger)", "#7c6af7", "#00bfff", "#ff69b4"];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 12 }, (_, i) => `${i + 8}:00`);

// Forecast data — 7 days of actuals + 7 days predicted (predicted has no utilization_pct, only predicted_pct)
const forecastData = [
  { period: "Mar 15", utilization_pct: 54, predicted_pct: null },
  { period: "Mar 16", utilization_pct: 61, predicted_pct: null },
  { period: "Mar 17", utilization_pct: 45, predicted_pct: null },
  { period: "Mar 18", utilization_pct: 38, predicted_pct: null },
  { period: "Mar 19", utilization_pct: 72, predicted_pct: null },
  { period: "Mar 20", utilization_pct: 68, predicted_pct: null },
  { period: "Mar 21", utilization_pct: 49, predicted_pct: 49 },
  { period: "Mar 22", utilization_pct: null, predicted_pct: 58 },
  { period: "Mar 23", utilization_pct: null, predicted_pct: 63 },
  { period: "Mar 24", utilization_pct: null, predicted_pct: 71 },
  { period: "Mar 25", utilization_pct: null, predicted_pct: 85 },
  { period: "Mar 26", utilization_pct: null, predicted_pct: 78 },
  { period: "Mar 27", utilization_pct: null, predicted_pct: 55 },
];

const forecastCards = [
  { label: "Tomorrow's Predicted Peak", value: "85%", sub: "at 10am in McNulty Hall", icon: "◈", color: "var(--warning)" },
  { label: "Highest Risk Day", value: "Mar 25", sub: "71% avg campus utilization", icon: "◬", color: "var(--danger)" },
  { label: "Best Availability Window", value: "Mar 27", sub: "55% avg — good for events", icon: "◎", color: "var(--accent)" },
];

function getUtilizationData(range, buildingFilter) {
  const multiplier = range === "7d" ? 1 : range === "30d" ? 0.9 : 0.8;
  if (buildingFilter === "all") {
    return mockUtilizationData.map(d => ({ ...d, utilization_pct: Math.round(d.utilization_pct * multiplier) }));
  }
  return mockUtilizationData.map(d => {
    const row = { period: d.period };
    mockBuildings.forEach((b) => {
      row[b.name] = Math.round(d.utilization_pct * multiplier * (0.6 + Math.random() * 0.8));
    });
    return row;
  });
}

function HeatmapCell({ value }) {
  const opacity = value / 100;
  const bg = `rgba(0, 200, 150, ${0.08 + opacity * 0.92})`;
  return (
    <div
      className="rounded flex items-center justify-center cursor-pointer transition-all"
      style={{ background: bg, color: value > 55 ? "#000" : "var(--text-muted)", fontSize: "10px", height: 28 }}
      title={`${value}% utilization`}
    >
      {value}%
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        p.value != null && (
          <p key={i} style={{ fontSize: 13, color: p.color, fontWeight: 600 }}>
            {p.name}: {p.value}%
          </p>
        )
      ))}
    </div>
  );
};

export default function Analytics() {
  const [range, setRange] = useState("7d");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [showForecast, setShowForecast] = useState(false);

  const chartData = useMemo(() => getUtilizationData(range, buildingFilter), [range, buildingFilter]);

  const handleRangeChange = (r) => {
    setLoading(true);
    setRange(r);
    setTimeout(() => setLoading(false), 600);
  };

  const handleBuildingChange = (e) => {
    setLoading(true);
    setBuildingFilter(e.target.value);
    setTimeout(() => setLoading(false), 600);
  };

  const handleForecast = () => {
    setLoadingForecast(true);
    setShowForecast(false);
    // Replace with: await apiClient.post("/api/ai/predict")
    setTimeout(() => {
      setLoadingForecast(false);
      setShowForecast(true);
    }, 2000);
  };

  const heatmap = days.map((day) =>
    hours.map((_, hi) => {
      const found = mockHeatmapData.find((d) => d.day === day && d.hour === hi + 8);
      return found ? found.value : 0;
    })
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {["7d", "30d", "semester"].map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
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
          onChange={handleBuildingChange}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: "13px",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="all">All Buildings</option>
          {mockBuildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Utilization chart */}
      {loading ? (
        <ChartSkeleton height={260} />
      ) : (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
            Utilization Over Time
            {buildingFilter !== "all" && (
              <span style={{ color: "var(--accent)", marginLeft: 8, fontWeight: 400, fontSize: "13px" }}>
                — {mockBuildings.find(b => b.id === buildingFilter)?.name}
              </span>
            )}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "var(--text-muted)", fontSize: 12 }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              {buildingFilter === "all" ? (
                <Line
                  type="monotone"
                  dataKey="utilization_pct"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={{ fill: "var(--accent)", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Campus Average"
                  isAnimationActive
                  connectNulls={false}
                />
              ) : (
                mockBuildings.map((b, i) => (
                  <Line
                    key={b.id}
                    type="monotone"
                    dataKey={b.name}
                    stroke={BUILDING_COLORS[i % BUILDING_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive
                  />
                ))
              )}
              {buildingFilter !== "all" && <Legend />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Predictive Analytics Section */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
              🤖 Predictive Analytics
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>
              AI-powered 7-day utilization forecast
            </p>
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
            {loadingForecast ? "Generating forecast..." : showForecast ? "↻ Refresh Forecast" : "Generate Forecast"}
          </button>
        </div>

        {loadingForecast ? (
          <div className="flex flex-col gap-3">
            <div style={{ height: 200, borderRadius: 8, background: "var(--border)", animation: "shimmer 1.5s ease-in-out infinite" }} />
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 80, borderRadius: 8, background: "var(--border)", animation: "shimmer 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          </div>
        ) : showForecast ? (
          <div className="flex flex-col gap-4">
            {/* Forecast chart — solid actuals, dashed predictions */}
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x="Mar 21" stroke="var(--border)" strokeDasharray="4 2" label={{ value: "Today", fill: "var(--text-muted)", fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="utilization_pct"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={{ fill: "var(--accent)", r: 4 }}
                  name="Actual"
                  connectNulls={false}
                  isAnimationActive
                />
                <Line
                  type="monotone"
                  dataKey="predicted_pct"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ fill: "var(--warning)", r: 3 }}
                  name="Predicted"
                  connectNulls={false}
                  isAnimationActive
                />
                <Legend formatter={(v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v}</span>} />
              </LineChart>
            </ResponsiveContainer>

            {/* Forecast cards */}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {forecastCards.map((card, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4"
                  style={{ background: "var(--bg-primary)", border: `1px solid ${card.color}44` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: card.color, fontSize: 16 }}>{card.icon}</span>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {card.label}
                    </p>
                  </div>
                  <p style={{ fontSize: "24px", fontWeight: 800, color: card.color, fontFamily: "var(--font-display)", lineHeight: 1 }}>
                    {card.value}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 4 }}>{card.sub}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12" style={{ border: "1px dashed var(--border)", borderRadius: 8 }}>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Click "Generate Forecast" to run AI prediction
            </p>
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
          Usage Heatmap — Hour × Day
        </p>
        <div style={{ overflowX: "auto" }}>
          <div className="grid mb-1" style={{ gridTemplateColumns: `60px repeat(12, 1fr)`, gap: 3, minWidth: 600 }}>
            <div />
            {hours.map((h) => (
              <div key={h} style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center" }}>{h}</div>
            ))}
          </div>
          {days.map((day, di) => (
            <div key={day} className="grid mb-1" style={{ gridTemplateColumns: `60px repeat(12, 1fr)`, gap: 3, minWidth: 600 }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{day}</div>
              {heatmap[di].map((val, hi) => (
                <HeatmapCell key={hi} value={val} />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4">
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Low</span>
          <div style={{ height: 8, flex: 1, borderRadius: 4, background: "linear-gradient(90deg, rgba(0,200,150,0.08), rgba(0,200,150,1))" }} />
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>High</span>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}