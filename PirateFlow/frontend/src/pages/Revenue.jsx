import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import StatsCard from "../components/StatsCard";
import { ChartSkeleton, StatsCardSkeleton } from "../components/LoadingSkeleton";

const PIE_COLORS = ["var(--accent)", "var(--warning)", "var(--danger)", "#7c6af7"];

export default function Revenue() {
  const [revenueData, setRevenueData] = useState(null);
  const [opportunity, setOpportunity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insight, setInsight] = useState(null);

  const token = localStorage.getItem("pf_access");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [revRes, oppRes] = await Promise.all([
          fetch("/api/analytics/revenue", { headers }),
          fetch("/api/analytics/revenue/opportunity", { headers }),
        ]);
        const rev = await revRes.json();
        const opp = await oppRes.json();
        setRevenueData(rev);
        setOpportunity(Array.isArray(opp) ? opp : opp.rooms || opp.data || []);
      } catch {
        setRevenueData(null);
        setOpportunity([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const generateInsight = async () => {
    setLoadingInsight(true);
    setInsight(null);
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ query: "Which rooms are most underutilized and what is the revenue opportunity?" }),
      });
      const data = await res.json();
      setInsight(data.summary || data.response || data.message || "AI analysis complete. Check the opportunity table for details.");
    } catch {
      setInsight("Unable to generate AI insight at this time. Check the revenue opportunity table for underutilized spaces.");
    } finally {
      setLoadingInsight(false);
    }
  };

  const r = revenueData;
  const untapped = opportunity.reduce((sum, row) => sum + (row.weekly_revenue_potential || row.weekly_potential || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <StatsCardSkeleton /><StatsCardSkeleton /><StatsCardSkeleton />
        </div>
        <ChartSkeleton height={220} />
        <ChartSkeleton height={200} />
      </div>
    );
  }

  if (!r) {
    return (
      <div className="p-6 flex flex-col items-center gap-4 py-20">
        <p style={{ fontSize: 32 }}>◻</p>
        <p style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 600 }}>Revenue data unavailable</p>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>The analytics endpoint may still be initializing.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Summary cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <StatsCard
          label="Total Revenue"
          value={`$${(r.total || r.total_revenue || 0).toLocaleString()}`}
          sub="This semester"
          accent
          trend={{ direction: "up", pct: 12 }}
        />
        <StatsCard
          label="External Rental"
          value={`$${(r.external_rental || r.external_rental_income || 0).toLocaleString()}`}
          trend={{ direction: "up", pct: 8 }}
        />
        <StatsCard
          label="Dept. Chargebacks"
          value={`$${(r.chargebacks || r.department_chargebacks || 0).toLocaleString()}`}
          trend={{ direction: "down", pct: 3 }}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Revenue by building */}
        {(r.by_building || r.building_breakdown || []).length > 0 && (
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>Revenue by Building</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={r.by_building || r.building_breakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis type="category" dataKey="building_name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={90} />
                <Tooltip formatter={v => [`$${v.toLocaleString()}`, "Revenue"]} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="amount" fill="var(--accent)" radius={[0, 4, 4, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenue by room type */}
        {(r.by_room_type || r.room_type_breakdown || []).length > 0 && (
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>Revenue by Room Type</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={r.by_room_type || r.room_type_breakdown} dataKey="amount" nameKey="room_type" cx="50%" cy="50%" outerRadius={80} innerRadius={45} isAnimationActive>
                  {(r.by_room_type || r.room_type_breakdown || []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend formatter={v => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Revenue over time */}
      {(r.over_time || r.monthly_breakdown || []).length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-4" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>Revenue Over Time</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={r.over_time || r.monthly_breakdown}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Tooltip formatter={v => [`$${v.toLocaleString()}`, "Revenue"]} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Area type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={2.5} fill="url(#revGrad)" isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Opportunity table */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>Revenue Opportunity</p>
          {untapped > 0 && (
            <div className="rounded-xl px-4 py-2" style={{ background: "var(--accent-muted)", border: "1px solid var(--accent)" }}>
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Untapped: </span>
              <span style={{ fontWeight: 800, fontSize: "20px", color: "var(--accent)", fontFamily: "var(--font-display)" }}>
                ${untapped.toLocaleString()}<span style={{ fontSize: "13px" }}>/wk</span>
              </span>
            </div>
          )}
        </div>
        {opportunity.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>No underutilized rooms found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "13px", minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Room", "Building", "Type", "Utilization", "Rate/Hr", "Weekly Potential"].map(h => (
                    <th key={h} className="text-left py-2 px-3" style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {opportunity.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--accent-muted)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td className="py-3 px-3" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{row.room_name}</td>
                    <td className="py-3 px-3" style={{ color: "var(--text-muted)" }}>{row.building_name || row.building}</td>
                    <td className="py-3 px-3" style={{ color: "var(--text-muted)" }}>{row.room_type || row.type}</td>
                    <td className="py-3 px-3"><span style={{ color: "var(--danger)", fontWeight: 700 }}>{Math.round((row.utilization_pct || 0) > 1 ? row.utilization_pct : row.utilization_pct * 100)}%</span></td>
                    <td className="py-3 px-3" style={{ color: "var(--text-muted)" }}>${row.hourly_rate || 0}</td>
                    <td className="py-3 px-3" style={{ color: "var(--success)", fontWeight: 700 }}>${(row.weekly_revenue_potential || row.weekly_potential || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Insight */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>🤖 AI Revenue Insight</p>
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
            {loadingInsight ? "Analyzing..." : insight ? "↻ Regenerate" : "Generate Insight"}
          </button>
        </div>
        {loadingInsight ? (
          <div className="flex flex-col gap-2">
            {[90, 75, 60].map((w, i) => (
              <div key={i} style={{ height: 14, borderRadius: 6, background: "var(--border)", width: `${w}%`, animation: "shimmer 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : insight ? (
          <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.7 }}>{insight}</p>
        ) : (
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Click "Generate Insight" to get an AI-powered revenue analysis.</p>
        )}
      </div>

      <style>{`@keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }`}</style>
    </div>
  );
}