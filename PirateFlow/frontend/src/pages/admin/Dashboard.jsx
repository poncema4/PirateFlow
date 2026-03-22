import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useWebSocket } from "../../context/WebSocketContext";
import { useAuth } from "../../hooks/useAuth";
import StatsCard from "../../components/common/StatsCard";
import BuildingCard from "../../components/feed/BuildingCard";
import ActivityFeed from "../../components/feed/ActivityFeed";
import { StatsCardSkeleton, BuildingCardSkeleton } from "../../components/common/LoadingSkeleton";


export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ws = useWebSocket();

  const [buildings, setBuildings] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const addActivity = useCallback((type, message) => {
    setActivity((prev) => [
      { id: crypto.randomUUID(), type, message, timestamp: new Date().toISOString() },
      ...prev,
    ].slice(0, 50));
  }, []);

  // Fetch buildings from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getBuildings();
        if (!cancelled) {
          const list = Array.isArray(data) ? data : data.buildings || [];
          setBuildings(
            list.map((b) => ({
              ...b,
              current_occupancy_pct:
                b.current_occupancy_pct != null
                  ? b.current_occupancy_pct <= 1
                    ? Math.round(b.current_occupancy_pct * 100)
                    : Math.round(b.current_occupancy_pct)
                  : 0,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // WebSocket real-time listeners
  useEffect(() => {
    if (!ws) return;
    const handleOccupancy = (data) => {
      addActivity("occupancy", data.message || `${data.building || "Building"} occupancy changed`);
      if (data.building_id) {
        setBuildings((prev) =>
          prev.map((b) =>
            b.id === data.building_id
              ? { ...b, current_occupancy_pct: Math.round((data.occupancy ?? b.current_occupancy_pct / 100) * 100) }
              : b
          )
        );
      }
    };
    const handleBooking = (data) => addActivity("booking", data.message || "New booking event");
    const handleAnomaly = (data) => addActivity("anomaly", data.message || "Anomaly detected");

    ws.on("occupancy_update", handleOccupancy);
    ws.on("booking_update", handleBooking);
    ws.on("anomaly_alert", handleAnomaly);
    return () => {
      ws.off("occupancy_update", handleOccupancy);
      ws.off("booking_update", handleBooking);
      ws.off("anomaly_alert", handleAnomaly);
    };
  }, [ws, addActivity]);

  // Computed stats
  const totalRooms = buildings.reduce((s, b) => s + (b.room_count || 0), 0);
  const occupiedRooms = buildings.reduce((s, b) => s + (b.occupied_rooms || 0), 0);
  const avgOccupancy = buildings.length
    ? Math.round(buildings.reduce((s, b) => s + b.current_occupancy_pct, 0) / buildings.length)
    : 0;
  const highOccupancy = buildings.filter((b) => b.current_occupancy_pct > 75).length;

  return (
    <div className="p-4 flex flex-col gap-4" style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
            Admin Dashboard
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Welcome back, {user?.name || "Admin"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full"
            style={{ width: 7, height: 7, background: ws?.connected ? "var(--success)" : "var(--danger)" }}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {ws?.connected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--danger)22", border: "1px solid var(--danger)44", color: "var(--danger)", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)
        ) : (
          <>
            <StatsCard label="Buildings" value={buildings.length} sub="Total monitored" accent />
            <StatsCard label="Total Rooms" value={totalRooms} sub={`${occupiedRooms} occupied`} />
            <StatsCard label="Avg Occupancy" value={`${avgOccupancy}%`} sub="Across all buildings" accent={avgOccupancy > 40} danger={avgOccupancy > 75} />
            <StatsCard label="High Occupancy" value={highOccupancy} sub="Buildings > 75%" danger={highOccupancy > 0} />
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Building Grid */}
        <div className="lg:col-span-2">
          <p className="mb-2" style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
            Building Status
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <BuildingCardSkeleton key={i} />)
              : buildings.map((b) => (
                  <BuildingCard key={b.id} building={b} onClick={() => navigate(`/buildings/${b.id}`)} />
                ))}
            {!loading && buildings.length === 0 && (
              <p className="col-span-full py-8 text-center" style={{ color: "var(--text-muted)", fontSize: 12 }}>
                No buildings found
              </p>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-1">
          <ActivityFeed items={activity} />
        </div>
      </div>
    </div>
  );
}
