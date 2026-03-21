import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatsCard from "../../components/common/StatsCard";
import { StatsCardSkeleton, ChartSkeleton, TableSkeleton } from "../../components/common/LoadingSkeleton";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const PIE_COLORS = ["var(--accent)", "var(--warning)", "var(--success)", "var(--danger)", "#8b5cf6", "#f472b6"];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }}>
      {label && <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey || p.name} style={{ color: p.color || p.fill }}>
          {p.name}: ${typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

export default function Revenue() {
  const [revenue, setRevenue] = useState(null);
  const [opportunity, setOpportunity] = useState(null);
  const [insight, setInsight] = useState(null);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [loadingOpp, setLoadingOpp] = useState(true);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getRevenue()
      .then((d) => setRevenue(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingRevenue(false));

    api.getRevenueOpportunity()
      .then((d) => setOpportunity(d))
      .catch(() => {})
      .finally(() => setLoadingOpp(false));
  }, []);

  const handleInsight = async () => {
    setLoadingInsight(true);
    try {
      const data = await api.aiSearch("Analyze revenue trends, identify top opportunities, and suggest pricing optimizations");
      setInsight(data);
    } catch {
      setInsight({ answer: "Unable to generate insights at this time." });
    } finally {
      setLoadingInsight(false);
    }
  };

  // Derived data
  const totalRevenue = revenue?.total_revenue ?? revenue?.total ?? 0;
  const monthlyRevenue = revenue?.monthly_revenue ?? revenue?.monthly ?? 0;
  const bookingCount = revenue?.total_bookings ?? revenue?.bookings ?? 0;
  const avgPerBooking = bookingCount > 0 ? Math.round(totalRevenue / bookingCount) : 0;

  const byBuilding = revenue?.by_building || [];
  const byType = revenue?.by_room_type || revenue?.by_type || [];
  const overTime = revenue?.over_time || revenue?.timeline || revenue?.monthly_trend || [];

  const oppRooms = opportunity?.rooms || opportunity?.underutilized || opportunity?.opportunities || [];

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        Revenue Dashboard
      </h1>

      {error && (
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--danger)22", color: "var(--danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loadingRevenue ? (
          Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)
        ) : (
          <>
            <StatsCard label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} sub="All time" accent />
            <StatsCard label="Monthly Revenue" value={`$${monthlyRevenue.toLocaleString()}`} sub="Current month" />
            <StatsCard label="Total Bookings" value={bookingCount.toLocaleString()} sub="Completed" />
            <StatsCard label="Avg / Booking" value={`$${avgPerBooking}`} sub="Revenue per booking" />
          </>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Building */}
        {loadingRevenue ? (
          <ChartSkeleton height={220} />
        ) : byBuilding.length > 0 ? (
          <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="mb-3" style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
              Revenue by Building
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byBuilding}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey={byBuilding[0]?.name ? "name" : "building"} tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No building revenue data</p>
          </div>
        )}

        {/* Revenue by Room Type */}
        {loadingRevenue ? (
          <ChartSkeleton height={220} />
        ) : byType.length > 0 ? (
          <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="mb-3" style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
              Revenue by Room Type
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="revenue"
                  nameKey={byType[0]?.type ? "type" : "name"}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  style={{ fontSize: 9 }}
                >
                  {byType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No room type revenue data</p>
          </div>
        )}
      </div>

      {/* Revenue Over Time */}
      {loadingRevenue ? (
        <ChartSkeleton height={200} />
      ) : overTime.length > 0 ? (
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-3" style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            Revenue Over Time
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={overTime}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={overTime[0]?.date ? "date" : overTime[0]?.month ? "month" : "period"} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="var(--accent)" fill="url(#revenueGrad)" strokeWidth={2} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No timeline data available</p>
        </div>
      )}

      {/* Opportunity Table */}
      {loadingOpp ? (
        <TableSkeleton rows={4} />
      ) : oppRooms.length > 0 ? (
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="mb-3" style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            Revenue Opportunities — Underutilized Rooms
          </p>
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Room", "Building", "Type", "Utilization", "Potential Revenue"].map((h) => (
                    <th key={h} className="text-left py-2 px-2" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oppRooms.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 px-2" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.room_name || r.name || r.room_id}</td>
                    <td className="py-2 px-2" style={{ color: "var(--text-muted)" }}>{r.building_name || r.building || "—"}</td>
                    <td className="py-2 px-2" style={{ color: "var(--text-muted)" }}>{r.room_type || r.type || "—"}</td>
                    <td className="py-2 px-2">
                      <span
                        className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: "var(--warning)22", color: "var(--warning)" }}
                      >
                        {Math.round(r.utilization ?? r.usage ?? 0)}%
                      </span>
                    </td>
                    <td className="py-2 px-2" style={{ fontWeight: 600, color: "var(--success)" }}>
                      ${(r.potential_revenue ?? r.opportunity ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No revenue opportunities identified</p>
        </div>
      )}

      {/* AI Insight */}
      <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>AI Revenue Insights</p>
          <button
            onClick={handleInsight}
            disabled={loadingInsight}
            className="rounded-lg px-3 py-1.5"
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: "var(--accent)",
              color: "var(--bg-primary)",
              border: "none",
              cursor: loadingInsight ? "wait" : "pointer",
              opacity: loadingInsight ? 0.6 : 1,
            }}
          >
            {loadingInsight ? "Analyzing..." : "Generate Insights"}
          </button>
        </div>
        {insight ? (
          <div className="flex flex-col gap-2">
            {insight.answer && (
              <p style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {insight.answer}
              </p>
            )}
            {insight.recommendations?.map((rec, i) => (
              <p key={i} style={{ fontSize: 11, color: "var(--text-muted)" }}>&bull; {rec}</p>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Click to generate AI-powered revenue analysis and optimization suggestions
          </p>
        )}
      </div>
    </div>
  );
}
