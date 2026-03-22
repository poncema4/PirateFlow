import { useEffect, useState, useMemo } from "react";
import { api } from "../../api/client";
import { ChartSkeleton } from "../../components/common/LoadingSkeleton";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const TIME_RANGES = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "semester", label: "Semester" },
];

const PIE_COLORS = ["#00e6b4", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const ROOM_TYPE_LABELS = {
  classroom: "Classroom",
  lecture_hall: "Lecture Hall",
  computer_lab: "Computer Lab",
  science_lab: "Science Lab",
  study_room: "Study Room",
  conference_room: "Conference Room",
  event_space: "Event Space",
  multipurpose: "Multipurpose",
};

const BOOKING_TYPE_LABELS = {
  internal_student: "Student",
  internal_staff: "Staff",
  internal_department: "Department",
  external: "External",
};

function formatRoomType(type) {
  return ROOM_TYPE_LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBookingType(type) {
  return BOOKING_TYPE_LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

function CustomTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="analytics-stat-card">
      <span className="analytics-stat-value">{value}</span>
      <span className="analytics-stat-label">{label}</span>
      {sub && <span className="analytics-stat-sub">{sub}</span>}
    </div>
  );
}

export default function Analytics() {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState("all");
  const [timeRange, setTimeRange] = useState("30d");

  // Existing data
  const [utilization, setUtilization] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [prediction, setPrediction] = useState(null);

  // New data
  const [summary, setSummary] = useState(null);
  const [roomTypes, setRoomTypes] = useState(null);
  const [topRooms, setTopRooms] = useState(null);
  const [departments, setDepartments] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [bookingTypes, setBookingTypes] = useState(null);

  // Loading states
  const [loadingUtil, setLoadingUtil] = useState(true);
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [error, setError] = useState(null);

  const params = useMemo(() => {
    const p = { time_range: timeRange };
    if (selectedBuilding !== "all") p.building_id = selectedBuilding;
    return p;
  }, [timeRange, selectedBuilding]);

  // Load buildings once
  useEffect(() => {
    api.getBuildings()
      .then((d) => setBuildings(Array.isArray(d) ? d : d.buildings || []))
      .catch(() => {});
  }, []);

  // Load summary
  useEffect(() => {
    setLoadingSummary(true);
    api.getAnalyticsSummary(params)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }, [params]);

  // Load utilization
  useEffect(() => {
    setLoadingUtil(true);
    api.getUtilization(params)
      .then(setUtilization)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingUtil(false));
  }, [params]);

  // Load heatmap
  useEffect(() => {
    setLoadingHeatmap(true);
    api.getHeatmap()
      .then(setHeatmap)
      .catch(() => {})
      .finally(() => setLoadingHeatmap(false));
  }, []);

  // Load new chart data
  useEffect(() => {
    setLoadingCharts(true);
    Promise.all([
      api.getRoomTypePopularity(params).catch(() => []),
      api.getTopRooms(params).catch(() => []),
      api.getDepartmentUsage(params).catch(() => []),
      api.getPeakHours(params).catch(() => []),
      api.getBookingTypes(params).catch(() => []),
    ]).then(([rt, tr, dept, ph, bt]) => {
      setRoomTypes(rt);
      setTopRooms(tr);
      setDepartments(dept);
      setPeakHours(ph);
      setBookingTypes(bt);
    }).finally(() => setLoadingCharts(false));
  }, [params]);

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
    const raw = utilization.trend || utilization.daily || utilization.data || utilization;
    if (!Array.isArray(raw)) return [];
    return raw.map((d) => ({
      ...d,
      date: d.date || d.day || d.label || d.period,
      utilization: (d.utilization ?? d.avg_utilization ?? d.utilization_pct ?? d.value ?? 0) * 100,
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

  // Format room type data for charts
  const roomTypeData = useMemo(() => {
    if (!roomTypes?.length) return [];
    return roomTypes.map((r) => ({
      ...r,
      name: formatRoomType(r.room_type),
    }));
  }, [roomTypes]);

  // Format top rooms
  const topRoomsData = useMemo(() => {
    if (!topRooms?.length) return [];
    return topRooms.map((r) => ({
      ...r,
      label: `${r.room_name}`,
    }));
  }, [topRooms]);

  // Format peak hours
  const peakHoursData = useMemo(() => {
    if (!peakHours?.length) return [];
    return peakHours.map((p) => ({
      ...p,
      label: `${p.hour}:00`,
      pct: Math.round((p.avg_utilization ?? 0) * 100),
    }));
  }, [peakHours]);

  // Format booking types for pie
  const bookingTypeData = useMemo(() => {
    if (!bookingTypes?.length) return [];
    return bookingTypes.map((b) => ({
      ...b,
      name: formatBookingType(b.booking_type),
    }));
  }, [bookingTypes]);

  // Format department data
  const deptData = useMemo(() => {
    if (!departments?.length) return [];
    return departments.slice(0, 10);
  }, [departments]);

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Campus Analytics</h1>
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

      {/* Summary Cards */}
      {loadingSummary ? (
        <ChartSkeleton height={80} />
      ) : summary ? (
        <div className="analytics-stats-grid">
          <StatCard label="Total Bookings" value={summary.total_bookings.toLocaleString()} />
          <StatCard label="Avg Students / Day" value={summary.avg_daily_users} />
          <StatCard
            label="Most Popular Type"
            value={formatRoomType(summary.most_popular_type)}
            sub={`${summary.most_popular_type_count} bookings`}
          />
          <StatCard label="Avg Booking Duration" value={`${summary.avg_duration_hrs}h`} />
          <StatCard label="Unique Users" value={summary.total_unique_users.toLocaleString()} />
        </div>
      ) : null}

      {/* Two-column chart grid */}
      <div className="analytics-chart-grid">
        {/* Room Type Popularity */}
        <div className="chart-card">
          <p className="chart-card-title">Bookings by Room Type</p>
          {loadingCharts ? (
            <ChartSkeleton height={220} />
          ) : roomTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={roomTypeData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_bookings" fill="var(--accent)" radius={[0, 4, 4, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="admin-card-meta">No room type data</p>
          )}
        </div>

        {/* Booking Type Breakdown (Pie) */}
        <div className="chart-card">
          <p className="chart-card-title">Booking Types</p>
          {loadingCharts ? (
            <ChartSkeleton height={220} />
          ) : bookingTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={bookingTypeData}
                  dataKey="total_bookings"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 11 }}
                >
                  {bookingTypeData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="admin-card-meta">No booking type data</p>
          )}
        </div>
      </div>

      {/* Top Booked Rooms */}
      <div className="chart-card">
        <p className="chart-card-title">Top 10 Most Booked Rooms</p>
        {loadingCharts ? (
          <ChartSkeleton height={280} />
        ) : topRoomsData.length > 0 ? (
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Room</th>
                  <th>Building</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Bookings</th>
                  <th>Hours Used</th>
                </tr>
              </thead>
              <tbody>
                {topRoomsData.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.room_name}</td>
                    <td>{r.building_name}</td>
                    <td>{formatRoomType(r.room_type)}</td>
                    <td>{r.capacity}</td>
                    <td>{r.total_bookings}</td>
                    <td>{r.total_hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-card-meta">No booking data</p>
        )}
      </div>

      {/* Two-column: Peak Hours + Department Usage */}
      <div className="analytics-chart-grid">
        {/* Peak Hours */}
        <div className="chart-card">
          <p className="chart-card-title">Peak Hours</p>
          {loadingCharts ? (
            <ChartSkeleton height={220} />
          ) : peakHoursData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip suffix="%" />} />
                <Bar dataKey="pct" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Activity" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="admin-card-meta">No peak hours data</p>
          )}
        </div>

        {/* Department / Major Usage */}
        <div className="chart-card">
          <p className="chart-card-title">Usage by Department / Major</p>
          {loadingCharts ? (
            <ChartSkeleton height={220} />
          ) : deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis dataKey="department" type="category" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_bookings" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="admin-card-meta">No department data</p>
          )}
        </div>
      </div>

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
              <Tooltip content={<CustomTooltip suffix="%" />} />
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
              <Tooltip content={<CustomTooltip suffix="%" />} />
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
