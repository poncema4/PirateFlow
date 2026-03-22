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

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="dashboard">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <h1>{greeting}, {user?.name?.split(" ")[0] || "Admin"}</h1>
        <p>
          Here's an overview of your campus spaces. Monitor building occupancy, track bookings, and stay on top of alerts.
        </p>
      </div>

      {error && (
        <div className="error-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="stats-grid">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)
        ) : (
          <>
            <StatsCard label="Buildings" value={buildings.length} sub="Total monitored" accent icon="buildings" onClick={() => navigate("/admin/spaces")} />
            <StatsCard label="Total Rooms" value={totalRooms} sub={`${occupiedRooms} occupied`} icon="rooms" onClick={() => navigate("/admin/spaces")} />
            <StatsCard label="Avg Occupancy" value={`${avgOccupancy}%`} sub="Across all buildings" accent={avgOccupancy > 40} danger={avgOccupancy > 75} icon="occupancy" onClick={() => navigate("/analytics")} />
            <StatsCard label="High Occupancy" value={highOccupancy} sub="Buildings > 75%" danger={highOccupancy > 0} icon="alert" onClick={() => navigate("/alerts")} />
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="content-grid">
        {/* Building Grid */}
        <div className="content-grid-main">
          <div className="section-header">
            <div className="section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <path d="M9 22v-4h6v4"/>
                <line x1="8" y1="6" x2="8" y2="6.01"/>
                <line x1="16" y1="6" x2="16" y2="6.01"/>
                <line x1="8" y1="10" x2="8" y2="10.01"/>
                <line x1="16" y1="10" x2="16" y2="10.01"/>
              </svg>
            </div>
            <p className="section-title">Building Status</p>
          </div>
          <div className="building-grid">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <BuildingCardSkeleton key={i} />)
              : buildings.map((b) => (
                  <BuildingCard key={b.id} building={b} onClick={() => navigate(`/spaces/${b.id}`)} />
                ))}
            {!loading && buildings.length === 0 && (
              <div className="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2"/>
                  <path d="M9 22v-4h6v4"/>
                </svg>
                <h3>No buildings found</h3>
                <p>Buildings will appear here once added</p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div>
          <ActivityFeed items={activity} />
        </div>
      </div>
    </div>
  );
}
