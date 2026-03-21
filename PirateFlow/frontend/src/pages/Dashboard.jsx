import { useState, useEffect, useRef } from "react";
import StatsCard from "../components/StatsCard";
import BuildingCard from "../components/BuildingCard";
import ActivityFeed from "../components/ActivityFeed";
import { mockBuildings, mockStats, mockActivityFeed } from "../api/mockData";

const eventTemplates = [
  { type: "occupancy", messages: [
    (r, b) => `Room ${r} in ${b} is now occupied`,
    (r, b) => `Room ${r} in ${b} is now available`,
    (r, b) => `Study space ${r} in ${b} just opened up`,
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

const roomNames = ["Room 101", "Room 204", "Study Room A", "Study Room B", "Lab 301", "Conference Room A", "Seminar Room 2"];
const buildingNames = ["Walsh Library", "McNulty Hall", "Jubilee Hall", "Fahy Hall", "Corrigan Hall", "Stafford Hall"];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEvent(id) {
  const template = eventTemplates[randomBetween(0, eventTemplates.length - 1)];
  const room = roomNames[randomBetween(0, roomNames.length - 1)];
  const building = buildingNames[randomBetween(0, buildingNames.length - 1)];
  const msg = template.messages[randomBetween(0, template.messages.length - 1)];
  return {
    id: String(id),
    type: template.type,
    message: msg(room, building),
    timestamp: new Date().toISOString(),
  };
}

export default function Dashboard() {
  const [buildingData, setBuildingData] = useState(mockBuildings);
  const [stats, setStats] = useState(mockStats);
  const [activity, setActivity] = useState(mockActivityFeed);
  const [demoMode, setDemoMode] = useState(true);
  const eventIdRef = useRef(100);

  useEffect(() => {
    // Swap with real API calls when backend is ready:
    // apiClient.get("/buildings").then(res => setBuildingData(res.data));
    // apiClient.get("/stats").then(res => setStats(res.data));
  }, []);

  // Real-time simulation
  useEffect(() => {
    if (!demoMode) return;

    const interval = setInterval(() => {
      // Update random buildings occupancy
      setBuildingData(prev => prev.map(b => {
        if (Math.random() > 0.6) return b;
        const delta = randomBetween(-3, 3);
        const newPct = Math.min(100, Math.max(0, b.current_occupancy_pct + delta));
        const newOccupied = Math.round((newPct / 100) * b.room_count);
        return { ...b, current_occupancy_pct: newPct, occupied_rooms: newOccupied };
      }));

      // Update stats
      setStats(prev => ({
        ...prev,
        currently_occupied: Math.max(0, prev.currently_occupied + randomBetween(-2, 2)),
        occupancy_pct: Math.max(0, prev.occupancy_pct + randomBetween(-1, 1)),
        todays_bookings: prev.todays_bookings + (Math.random() > 0.7 ? 1 : 0),
      }));

      // Add new activity event
      const newEvent = generateEvent(eventIdRef.current++);
      setActivity(prev => [newEvent, ...prev].slice(0, 25));

    }, 3000);

    return () => clearInterval(interval);
  }, [demoMode]);

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
              Live Demo Mode — Simulating real-time campus activity
            </span>
          </div>
          <button
            onClick={() => setDemoMode(false)}
            style={{ fontSize: "12px", color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
          >
            Stop
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
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {buildingData.map((b) => (
              <BuildingCard key={b.id} building={b} onClick={() => {}} />
            ))}
          </div>
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