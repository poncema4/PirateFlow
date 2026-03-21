import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import StatsCard from "../components/StatsCard";
import BuildingCard from "../components/BuildingCard";
import ActivityFeed from "../components/ActivityFeed";
import { api } from "../api/client";
import { useWebSocket } from "../context/WebSocketContext";
import { mockActivityFeed } from "../api/mockData";

const roomNames = ["Room 101", "Room 204", "Study Room A", "Study Room B", "Lab 301", "Conference Room A", "Seminar Room 2"];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const eventTemplates = [
  { type: "occupancy", messages: [
    (r, b) => `Room ${r} in ${b} is now occupied`,
    (r, b) => `Room ${r} in ${b} is now available`,
  ]},
  { type: "booking", messages: [
    (r, b) => `New booking: ${r}, ${b}`,
    (r, b) => `Booking confirmed: ${r} in ${b}`,
    (r, b) => `Booking cancelled: ${r}, ${b}`,
  ]},
  { type: "anomaly", messages: [
    (_, b) => `Unusual activity detected in ${b}`,
    (r, b) => `Ghost booking pattern flagged: ${r} in ${b}`,
  ]},
];

function generateEvent(id, buildingNames) {
  const template = eventTemplates[randomBetween(0, eventTemplates.length - 1)];
  const room = roomNames[randomBetween(0, roomNames.length - 1)];
  const building = buildingNames[randomBetween(0, buildingNames.length - 1)] || "Campus";
  const msg = template.messages[randomBetween(0, template.messages.length - 1)];
  return {
    id: String(id),
    type: template.type,
    message: msg(room, building),
    timestamp: new Date().toISOString(),
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { on, off } = useWebSocket();

  const [buildingData, setBuildingData] = useState([]);
  const [stats, setStats] = useState({
    total_rooms: 0,
    currently_occupied: 0,
    occupancy_pct: 0,
    todays_bookings: 0,
    active_alerts: 0,
    critical_alerts: 0,
  });
  const [activity, setActivity] = useState(mockActivityFeed);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(true);
  const eventIdRef = useRef(100);

  // ── Fetch real data from backend ────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const buildings = await api.getBuildings();
        setBuildingData(buildings);

        // Derive stats from buildings
        const totalRooms = buildings.reduce((sum, b) => sum + b.room_count, 0);
        const occupiedRooms = buildings.reduce(
          (sum, b) => sum + Math.round(b.current_occupancy_pct * b.room_count), 0
        );
        const avgOccupancy = totalRooms > 0
          ? Math.round((occupiedRooms / totalRooms) * 100)
          : 0;

        setStats(prev => ({
          ...prev,
          total_rooms: totalRooms,
          currently_occupied: occupiedRooms,
          occupancy_pct: avgOccupancy,
        }));
      } catch (err) {
        console.error("Failed to fetch buildings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ── WebSocket: listen for real-time events ──────────────────────────────────
  useEffect(() => {
    const handleOccupancy = (data) => {
      setBuildingData(prev => prev.map(b =>
        b.id === data.building_id
          ? { ...b, current_occupancy_pct: data.occupancy_pct }
          : b
      ));
      const newEvent = {
        id: String(eventIdRef.current++),
        type: "occupancy",
        message: `${data.room_name} in ${data.building_name} is now ${data.status}`,
        timestamp: new Date().toISOString(),
      };
      setActivity(prev => [newEvent, ...prev].slice(0, 25));
    };

    const handleBooking = (data) => {
      setStats(prev => ({
        ...prev,
        todays_bookings: prev.todays_bookings + 1,
      }));
      const newEvent = {
        id: String(eventIdRef.current++),
        type: "booking",
        message: `New booking: ${data.room_name}, ${data.building_name}`,
        timestamp: new Date().toISOString(),
      };
      setActivity(prev => [newEvent, ...prev].slice(0, 25));
    };

    const handleAnomaly = (data) => {
      setStats(prev => ({
        ...prev,
        active_alerts: prev.active_alerts + 1,
        critical_alerts: data.severity === "critical"
          ? prev.critical_alerts + 1
          : prev.critical_alerts,
      }));
      const newEvent = {
        id: String(eventIdRef.current++),
        type: "anomaly",
        message: data.description || `Anomaly detected in ${data.building_name}`,
        timestamp: new Date().toISOString(),
      };
      setActivity(prev => [newEvent, ...prev].slice(0, 25));
    };

    const handleAccessAlert = (data) => {
      setStats(prev => ({
        ...prev,
        active_alerts: prev.active_alerts + 1,
        critical_alerts: prev.critical_alerts + 1,
      }));
      const newEvent = {
        id: String(eventIdRef.current++),
        type: "anomaly",
        message: data.description || `Unauthorized access detected in ${data.room_name}`,
        timestamp: new Date().toISOString(),
      };
      setActivity(prev => [newEvent, ...prev].slice(0, 25));
    };

    on("occupancy_changed", handleOccupancy);
    on("booking_created", handleBooking);
    on("booking_cancelled", handleBooking);
    on("anomaly_alert", handleAnomaly);
    on("access_alert", handleAccessAlert);

    return () => {
      off("occupancy_changed", handleOccupancy);
      off("booking_created", handleBooking);
      off("booking_cancelled", handleBooking);
      off("anomaly_alert", handleAnomaly);
      off("access_alert", handleAccessAlert);
    };
  }, [on, off]);

  // ── Demo simulation (runs while waiting for real WebSocket events) ──────────
  useEffect(() => {
    if (!demoMode || buildingData.length === 0) return;

    const buildingNames = buildingData.map(b => b.name);

    const interval = setInterval(() => {
      setBuildingData(prev => prev.map(b => {
        if (Math.random() > 0.6) return b;
        const delta = (randomBetween(-3, 3)) / 100;
        const newPct = Math.min(1, Math.max(0, b.current_occupancy_pct + delta));
        return { ...b, current_occupancy_pct: newPct };
      }));

      setStats(prev => ({
        ...prev,
        currently_occupied: Math.max(0, prev.currently_occupied + randomBetween(-2, 2)),
        occupancy_pct: Math.max(0, prev.occupancy_pct + randomBetween(-1, 1)),
        todays_bookings: prev.todays_bookings + (Math.random() > 0.7 ? 1 : 0),
      }));

      const newEvent = generateEvent(eventIdRef.current++, buildingNames);
      setActivity(prev => [newEvent, ...prev].slice(0, 25));
    }, 3000);

    return () => clearInterval(interval);
  }, [demoMode, buildingData.length]);

  // Normalize building for BuildingCard (API returns 0-1 pct, card expects 0-100)
  const normalizedBuildings = buildingData.map(b => ({
    ...b,
    current_occupancy_pct: b.current_occupancy_pct > 1
      ? b.current_occupancy_pct
      : Math.round(b.current_occupancy_pct * 100),
    occupied_rooms: Math.round(b.current_occupancy_pct * b.room_count),
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Demo mode banner */}
      {demoMode && (
        <div
          className="flex items-center justify-between px-4 py-2 rounded-lg"
          style={{ background: "var(--accent-muted)", border: "1px solid var(--accent)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="rounded-full"
              style={{
                width: 8,
                height: 8,
                background: "var(--accent)",
                display: "inline-block",
                boxShadow: "0 0 8px var(--accent)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 600 }}>
              Live — Real-time campus activity
            </span>
          </div>
          <button
            onClick={() => setDemoMode(false)}
            style={{ fontSize: "12px", color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
          >
            Stop simulation
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatsCard label="Total Rooms" value={stats.total_rooms} />
        <StatsCard
          label="Currently Occupied"
          value={stats.currently_occupied}
          sub={`${stats.occupancy_pct}% of campus`}
          accent
        />
        <StatsCard label="Today's Bookings" value={stats.todays_bookings} />
        <StatsCard
          label="Active Alerts"
          value={stats.active_alerts}
          sub={stats.critical_alerts > 0 ? `${stats.critical_alerts} critical` : "All clear"}
          danger={stats.critical_alerts > 0}
        />
      </div>

      {/* Buildings + Activity */}
      <div className="flex gap-6" style={{ minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="mb-3"
            style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Buildings
          </p>
          {loading ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="rounded-xl animate-pulse"
                  style={{ height: 140, background: "var(--bg-card)", border: "1px solid var(--border)" }} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {normalizedBuildings.map((b) => (
                <BuildingCard
                  key={b.id}
                  building={b}
                  onClick={() => navigate(`/spaces/${b.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 280, flexShrink: 0 }}>
          <p className="mb-3" style={{ fontSize: "13px", color: "var(--text-muted)" }}>&nbsp;</p>
          <ActivityFeed items={activity} />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}