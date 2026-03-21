import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import StatsCard from "../components/StatsCard";
import { ChartSkeleton, StatsCardSkeleton } from "../components/LoadingSkeleton";
import { mockRevenueData, mockUnderutilized } from "../api/mockData";

const PIE_COLORS = ["var(--accent)", "var(--warning)", "var(--danger)", "#7c6af7"];

export default function Revenue() {
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insight, setInsight] = useState(
    "12 rooms across 4 buildings averaged under 20% utilization last semester. If opened for external booking at current rates, these spaces could generate an estimated $27,648 in additional revenue per semester — a 58% increase over current external rental income."
  );
  const r = mockRevenueData;

  const generateInsight = async () => {
    setLoadingInsight(true);
    setInsight(null);
    // Replace with: const res = await apiClient.post("/ai/revenue-insight");
    setTimeout(() => {
      setInsight("AI analysis complete: Stafford Hall Conference Room C remains the highest untapped opportunity at $2,980/week. Prioritizing external bookings during Thursday–Friday afternoons could yield a 34% revenue lift with minimal disruption to academic scheduling.");
      setLoadingInsight(false);
    }, 2200);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Summary cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <StatsCard
          label="Total Revenue"
          value={`$${r.total.toLocaleString()}`}
          sub="This semester"
          accent
          trend={{ direction: "up", pct: 12 }}
        />
        <StatsCard
          label="External Rental"
          value={`$${r.external_rental.toLocaleString()}`}
          trend={{ direction: "up", pct: 8 }}
        />
        <StatsCard
          label="Dept. Chargebacks"
          value={`$${r.chargebacks.toLocaleString()}`}
          trend={{ direction: "down", pct: 3 }}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
            Revenue by Building
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={r.by_building} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis type="category" dataKey="building_name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={90} />
              <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="amount" fill="var(--accent)" radius={[0, 4, 4, 0]} isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
            Revenue by Room Type
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={r.by_room_type} dataKey="amount" nameKey="room_type" cx="50%" cy="50%" outerRadius={80} innerRadius={45} isAnimationActive>
                {r.by_room_type.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend formatter={(v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue over time */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>Revenue Over Time</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={r.over_time}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }} />
            <Area type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={2.5} fill="url(#revGrad)" isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Opportunity section */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>Revenue Opportunity</p>
          <div className="rounded-xl px-4 py-2" style={{ background: "var(--accent-muted)", border: "1px solid var(--accent)" }}>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Untapped: </span>
            <span style={{ fontWeight: 800, fontSize: "20px", color: "var(--accent)", fontFamily: "var(--font-display)" }}>
              $27,648<span style={{ fontSize: "13px" }}>/sem</span>
            </span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "13px", minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Room", "Building", "Type", "Utilization", "Avail Hrs/Wk", "Rate/Hr", "Weekly Potential"].map((h) => (
                  <th key={h} className="text-left py-2 px-3" style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockUnderutilized.map((row, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--accent-muted)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td className="py-3 px-3" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{row.room_name}</td>
                  <td className="py-3 px-3" style={{ color: "var(--text-muted)" }}>{row.building}</td>
                  <td className="py-3 px-3" style={{ color: "var(--text-muted)" }}>{row.type}</td>
                  <td className="py-3 px-3"><span style={{ color: "var(--danger)", fontWeight: 700 }}>{row.utilization_pct}%</span></td>
                  <td className="py-3 px-3" style={{ color: "var(--text-muted)" }}>{row.available_hours}h</td>
                  <td className="py-3 px-3" style={{ color: "var(--text-muted)" }}>${row.hourly_rate}</td>
                  <td className="py-3 px-3" style={{ color: "var(--success)", fontWeight: 700 }}>${row.weekly_potential.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insight card */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
            🤖 AI Revenue Insight
          </p>
          <button
            onClick={generateInsight}
            disabled={loadingInsight}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: loadingInsight ? "var(--bg-card)" : "var(--accent)",
              color: loadingInsight ? "var(--text-muted)" : "#000",
              border: "1px solid var(--border)",
              cursor: loadingInsight ? "not-allowed" : "pointer",
            }}
          >
            {loadingInsight ? "Analyzing..." : "↻ Regenerate"}
          </button>
        </div>

        {loadingInsight ? (
          <div className="flex flex-col gap-2">
            <div style={{ height: 14, borderRadius: 6, background: "var(--border)", width: "90%", animation: "shimmer 1.5s ease-in-out infinite" }} />
            <div style={{ height: 14, borderRadius: 6, background: "var(--border)", width: "75%", animation: "shimmer 1.5s ease-in-out infinite" }} />
            <div style={{ height: 14, borderRadius: 6, background: "var(--border)", width: "60%", animation: "shimmer 1.5s ease-in-out infinite" }} />
          </div>
        ) : (
          <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.7 }}>
            {insight}
          </p>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}