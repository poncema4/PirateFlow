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
    <div className="p-8 flex flex-col gap-7" style={{ minHeight: "100vh" }}>
      {/* Welcome Banner */}
      <div
        className="rounded-2xl p-7 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #001a3a 0%, #002d62 40%, #004B8D 100%)",
          boxShadow: "0 8px 32px rgba(0,30,80,.2)",
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{
            fontSize: 26,
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            color: "#ffffff",
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}>
            {greeting}, {user?.name?.split(" ")[0] || "Admin"}
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.6)", maxWidth: 480, lineHeight: 1.6 }}>
            Here's an overview of your campus spaces. Monitor building occupancy, track bookings, and stay on top of alerts.
          </p>
        </div>
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: -40, right: -20, width: 200, height: 200,
          borderRadius: "50%", background: "rgba(255,255,255,.04)",
        }} />
        <div style={{
          position: "absolute", bottom: -60, right: 80, width: 160, height: 160,
          borderRadius: "50%", background: "rgba(255,255,255,.03)",
        }} />
        <div style={{
          position: "absolute", top: 20, right: 160, width: 80, height: 80,
          borderRadius: "50%", background: "rgba(255,255,255,.02)",
        }} />
      </div>

      {error && (
        <div
          className="rounded-xl px-5 py-4 flex items-center gap-3"
          style={{
            background: "rgba(192,57,43,.06)",
            border: "1px solid rgba(192,57,43,.15)",
            color: "var(--danger)",
            fontSize: 13.5,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)
        ) : (
          <>
            <StatsCard label="Buildings" value={buildings.length} sub="Total monitored" accent icon="buildings" />
            <StatsCard label="Total Rooms" value={totalRooms} sub={`${occupiedRooms} occupied`} icon="rooms" />
            <StatsCard label="Avg Occupancy" value={`${avgOccupancy}%`} sub="Across all buildings" accent={avgOccupancy > 40} danger={avgOccupancy > 75} icon="occupancy" />
            <StatsCard label="High Occupancy" value={highOccupancy} sub="Buildings > 75%" danger={highOccupancy > 0} icon="alert" />
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Building Grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5 mb-5">
            <div
              className="rounded-lg flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                background: "rgba(0,75,141,.08)",
                color: "#004B8D",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <path d="M9 22v-4h6v4"/>
                <line x1="8" y1="6" x2="8" y2="6.01"/>
                <line x1="16" y1="6" x2="16" y2="6.01"/>
                <line x1="8" y1="10" x2="8" y2="10.01"/>
                <line x1="16" y1="10" x2="16" y2="10.01"/>
              </svg>
            </div>
            <p style={{
              fontWeight: 700,
              fontSize: 17,
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
            }}>
              Building Status
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <BuildingCardSkeleton key={i} />)
              : buildings.map((b) => (
                  <BuildingCard key={b.id} building={b} onClick={() => navigate(`/buildings/${b.id}`)} />
                ))}
            {!loading && buildings.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16">
                <div
                  className="rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    width: 64,
                    height: 64,
                    background: "rgba(0,75,141,.05)",
                    color: "rgba(0,75,141,.2)",
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2"/>
                    <path d="M9 22v-4h6v4"/>
                  </svg>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 14, fontWeight: 600 }}>
                  No buildings found
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: 12.5, opacity: .7, marginTop: 4 }}>
                  Buildings will appear here once added
                </p>
              </div>
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
