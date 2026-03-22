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
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
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
    <div className="admin-page">
      <h1 className="admin-page-title">Revenue Dashboard</h1>

      {error && <div className="alert-danger">{error}</div>}

      {/* Stats */}
      <div className="stats-grid">
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
      <div className="form-row">
        {/* Revenue by Building */}
        {loadingRevenue ? (
          <ChartSkeleton height={220} />
        ) : byBuilding.length > 0 ? (
          <div className="chart-card">
            <p className="chart-card-title">Revenue by Building</p>
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
          <div className="empty-state">
            <p>No building revenue data</p>
          </div>
        )}

        {/* Revenue by Room Type */}
        {loadingRevenue ? (
          <ChartSkeleton height={220} />
        ) : byType.length > 0 ? (
          <div className="chart-card">
            <p className="chart-card-title">Revenue by Room Type</p>
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
          <div className="empty-state">
            <p>No room type revenue data</p>
          </div>
        )}
      </div>

      {/* Revenue Over Time */}
      {loadingRevenue ? (
        <ChartSkeleton height={200} />
      ) : overTime.length > 0 ? (
        <div className="chart-card">
          <p className="chart-card-title">Revenue Over Time</p>
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
        <div className="empty-state">
          <p>No timeline data available</p>
        </div>
      )}

      {/* Opportunity Table */}
      {loadingOpp ? (
        <TableSkeleton rows={4} />
      ) : oppRooms.length > 0 ? (
        <div className="chart-card">
          <p className="chart-card-title">Revenue Opportunities — Underutilized Rooms</p>
          <div className="admin-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {["Room", "Building", "Type", "Utilization", "Potential Revenue"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oppRooms.map((r, i) => (
                  <tr key={i}>
                    <td className="text-bold">{r.room_name || r.name || r.room_id}</td>
                    <td className="text-muted">{r.building_name || r.building || "—"}</td>
                    <td className="text-muted">{r.room_type || r.type || "—"}</td>
                    <td>
                      <span className="pill" style={{ background: "var(--warning)22", color: "var(--warning)" }}>
                        {Math.round(r.utilization ?? r.usage ?? 0)}%
                      </span>
                    </td>
                    <td className="text-bold" style={{ color: "var(--success)" }}>
                      ${(r.potential_revenue ?? r.opportunity ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>No revenue opportunities identified</p>
        </div>
      )}

      {/* AI Insight */}
      <div className="chart-card">
        <div className="admin-page-header">
          <p className="chart-card-title">AI Revenue Insights</p>
          <button
            onClick={handleInsight}
            disabled={loadingInsight}
            className="btn btn-primary btn-sm"
          >
            {loadingInsight ? "Analyzing..." : "Generate Insights"}
          </button>
        </div>
        {insight ? (
          <div className="admin-card-body">
            {insight.answer && (
              <p className="admin-card-meta">{insight.answer}</p>
            )}
            {insight.recommendations?.map((rec, i) => (
              <p key={i} className="admin-card-meta">&bull; {rec}</p>
            ))}
          </div>
        ) : (
          <p className="admin-card-meta">
            Click to generate AI-powered revenue analysis and optimization suggestions
          </p>
        )}
      </div>
    </div>
  );
}
