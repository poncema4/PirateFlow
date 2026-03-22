function Skeleton({ width = "100%", height = 20 }) {
  return (
    <div className="skeleton" style={{ width, height }} />
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="stats-card">
      <div className="stats-card-top">
        <Skeleton width="55%" height={12} />
        <Skeleton width={38} height={38} />
      </div>
      <Skeleton width="40%" height={30} />
      <Skeleton width="50%" height={12} />
    </div>
  );
}

export function BuildingCardSkeleton() {
  return (
    <div className="building-card">
      <div className="building-card-header">
        <div className="building-card-info">
          <Skeleton width={40} height={40} />
          <div>
            <Skeleton width={120} height={15} />
            <Skeleton width={80} height={11} />
          </div>
        </div>
        <Skeleton width={55} height={26} />
      </div>
      <Skeleton width="100%" height={8} />
      <Skeleton width="55%" height={12} />
    </div>
  );
}

export function ChartSkeleton({ height = 240 }) {
  return (
    <div className="chart-card">
      <Skeleton width="30%" height={14} />
      <Skeleton width="100%" height={height} />
    </div>
  );
}

export function TableSkeleton({ rows = 4 }) {
  return (
    <div className="chart-card">
      <Skeleton width="25%" height={14} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <Skeleton width="20%" height={12} />
          <Skeleton width="15%" height={12} />
          <Skeleton width="15%" height={12} />
          <Skeleton width="10%" height={12} />
          <Skeleton width="10%" height={12} />
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
