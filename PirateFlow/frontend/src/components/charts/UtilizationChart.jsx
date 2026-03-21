import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

const BUILDING_COLORS = ["var(--accent)", "var(--warning)", "var(--danger)", "#7c6af7", "#00bfff", "#ff69b4"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) =>
        p.value != null ? (
          <p key={i} style={{ fontSize: 12, color: p.color, fontWeight: 600 }}>
            {p.name}: {p.value}%
          </p>
        ) : null
      )}
    </div>
  );
};

export default function UtilizationChart({ data = [], mode = "single", buildingNames = [], height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />

        {mode === "single" && (
          <Line type="monotone" dataKey="utilization_pct" stroke="var(--accent)" strokeWidth={2.5}
            dot={{ fill: "var(--accent)", r: 3 }} activeDot={{ r: 5 }} name="Campus Average" connectNulls={false} isAnimationActive />
        )}

        {mode === "multi" && buildingNames.map((name, i) => (
          <Line key={name} type="monotone" dataKey={name} stroke={BUILDING_COLORS[i % BUILDING_COLORS.length]}
            strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive />
        ))}

        {mode === "forecast" && (
          <>
            <ReferenceLine x="Today" stroke="var(--border)" strokeDasharray="4 2"
              label={{ value: "Today", fill: "var(--text-muted)", fontSize: 10 }} />
            <Line type="monotone" dataKey="utilization_pct" stroke="var(--accent)" strokeWidth={2.5}
              dot={{ fill: "var(--accent)", r: 3 }} name="Actual" connectNulls={false} isAnimationActive />
            <Line type="monotone" dataKey="predicted_pct" stroke="var(--warning)" strokeWidth={2}
              strokeDasharray="6 3" dot={{ fill: "var(--warning)", r: 3 }} name="Predicted" connectNulls={false} isAnimationActive />
          </>
        )}

        {(mode === "multi" || mode === "forecast") && (
          <Legend formatter={(v) => <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{v}</span>} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
