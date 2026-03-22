import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["var(--accent)", "var(--warning)", "var(--danger)", "#7c6af7"];

const tooltipStyle = {
  contentStyle: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8 },
};

export default function RevenueChart({ type = "bar", data = [], height = 200 }) {
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
          <YAxis type="category" dataKey="building_name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} width={85} />
          <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} {...tooltipStyle} />
          <Bar dataKey="amount" fill="var(--accent)" radius={[0, 4, 4, 0]} isAnimationActive />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
          <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} {...tooltipStyle} />
          <Area type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={2.5} fill="url(#revGrad)" isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="amount" nameKey="room_type" cx="50%" cy="50%" outerRadius={70} innerRadius={40} isAnimationActive>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `$${v.toLocaleString()}`} {...tooltipStyle} />
          <Legend formatter={(v) => <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
