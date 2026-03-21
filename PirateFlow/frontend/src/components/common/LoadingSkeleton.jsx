function SkeletonBox({ width = "100%", height = 20, rounded = 8, className = "" }) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: rounded,
        background: "var(--border)",
        animation: "shimmer 1.5s ease-in-out infinite",
        backgroundImage: "linear-gradient(90deg, var(--border) 25%, #1e2a2a 50%, var(--border) 75%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <SkeletonBox width="60%" height={10} />
      <SkeletonBox width="40%" height={28} />
      <SkeletonBox width="50%" height={10} />
    </div>
  );
}

export function BuildingCardSkeleton() {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex justify-between">
        <div className="flex flex-col gap-2">
          <SkeletonBox width={120} height={14} />
          <SkeletonBox width={80} height={10} />
        </div>
        <SkeletonBox width={50} height={20} rounded={20} />
      </div>
      <SkeletonBox width="100%" height={5} rounded={4} />
      <SkeletonBox width="60%" height={10} />
    </div>
  );
}

export function ChartSkeleton({ height = 240 }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <SkeletonBox width="30%" height={14} className="mb-4" />
      <SkeletonBox width="100%" height={height} rounded={8} />
    </div>
  );
}

export function TableSkeleton({ rows = 4 }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <SkeletonBox width="25%" height={14} className="mb-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <SkeletonBox width="20%" height={12} />
          <SkeletonBox width="15%" height={12} />
          <SkeletonBox width="15%" height={12} />
          <SkeletonBox width="10%" height={12} />
          <SkeletonBox width="10%" height={12} />
        </div>
      ))}
    </div>
  );
}

export default function LoadingSkeleton({ type = "chart", ...props }) {
  if (type === "stats") return <StatsCardSkeleton />;
  if (type === "building") return <BuildingCardSkeleton />;
  if (type === "table") return <TableSkeleton {...props} />;
  return <ChartSkeleton {...props} />;
}
