import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { ROOM_TYPE_LABELS, EQUIPMENT_ICONS, STATUS_INFO } from "../../constants/rooms";
import RoomExpandedPanel from "../../components/booking/RoomExpandedPanel";
import React from "react";

const ROOM_TYPE_OPTIONS = Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({ value, label }));

function RoomCard({ room, isSelected, onClick }) {
  const status = STATUS_INFO[room.status] ?? STATUS_INFO.closed;
  return (
    <div onClick={onClick} className="rounded-xl p-3 cursor-pointer flex flex-col gap-2"
      style={{
        background: isSelected ? "var(--bg-primary)" : "var(--bg-card)",
        border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
        transition: "border-color 150ms, transform 150ms, box-shadow 150ms",
        boxShadow: isSelected ? "0 0 12px rgba(0,75,141,0.1)" : "none",
      }}
      onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "rgba(0,75,141,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; } }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{room.name}</h4>
        <span className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 10, color: status.color }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color, display: "inline-block", flexShrink: 0 }} />
          {status.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--border)", color: "var(--text-muted)", fontSize: 11 }}>{ROOM_TYPE_LABELS[room.room_type] || room.room_type}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>&#x25EB; {room.capacity}</span>
        {room.hourly_rate && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>${room.hourly_rate}/hr</span>}
      </div>
      {room.equipment?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {room.equipment.slice(0, 3).map((eq) => (
            <span key={eq} style={{ fontSize: 10, padding: "1px 6px", background: "var(--bg-primary)", borderRadius: 4, color: "var(--text-muted)" }}>{EQUIPMENT_ICONS[eq] || "\u00b7"} {eq.replace(/_/g, " ")}</span>
          ))}
          {room.equipment.length > 3 && <span style={{ fontSize: 10, color: "var(--text-muted)", padding: "1px 4px" }}>+{room.equipment.length - 3}</span>}
        </div>
      )}
    </div>
  );
}

function FloorSection({ floorName, rooms, expandedRoomId, onRoomClick, onClosePanel, onBook, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const availableCount = rooms.filter((r) => r.status === "available").length;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-2.5"
        style={{ background: "var(--bg-card)", border: "none", cursor: "pointer", textAlign: "left", transition: "background 150ms" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-card)"; }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{floorName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--border)", color: "var(--text-muted)", fontSize: 11 }}>{rooms.length} room{rooms.length !== 1 ? "s" : ""}</span>
          {availableCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,75,141,0.1)", color: "var(--success)", border: "1px solid rgba(0,75,141,0.2)", fontSize: 11 }}>{availableCount} available</span>
          )}
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: 11, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }}>\u25BE</span>
      </button>
      {open && (
        <div className="grid gap-2 p-3" style={{ background: "var(--bg-primary)", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {rooms.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0", gridColumn: "1 / -1" }}>No rooms match the current filters.</p>
          ) : (
            rooms.map((room) => (
              <React.Fragment key={room.id}>
                <RoomCard room={room} isSelected={expandedRoomId === room.id} onClick={() => onRoomClick(room.id)} />
                {expandedRoomId === room.id && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <RoomExpandedPanel roomId={room.id} onClose={onClosePanel} onBook={onBook} />
                  </div>
                )}
              </React.Fragment>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Skeleton({ height, className = "" }) {
  return <div className={`rounded-xl animate-pulse ${className}`} style={{ height, background: "var(--bg-card)", border: "1px solid var(--border)" }} />;
}

export default function BuildingDetail() {
  const { buildingId } = useParams();
  const navigate = useNavigate();

  const [building, setBuilding] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedRoomId, setExpandedRoomId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [minCapacity, setMinCapacity] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState("name");

  useEffect(() => {
    fetchData();
    setExpandedRoomId(null);
  }, [buildingId]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [buildingData, roomsData] = await Promise.all([
        api.getBuilding(buildingId),
        api.getRooms({ building_id: buildingId }),
      ]);
      setBuilding(buildingData.building);
      const filtered = roomsData.items.filter((r) => r.building_name === buildingData.building.name);
      setAllRooms(filtered);
    } catch {
      setError("Failed to load building details.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoomClick = (roomId) => {
    setExpandedRoomId((prev) => (prev === roomId ? null : roomId));
  };

  const handleBook = (roomId, roomName, date, startTime, endTime) => {
    const params = new URLSearchParams({ roomId, roomName });
    if (date) params.set("date", date);
    if (startTime) params.set("startTime", startTime);
    if (endTime) params.set("endTime", endTime);
    navigate(`/bookings/new?${params.toString()}`);
  };

  const visibleRooms = allRooms
    .filter((r) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(r.room_type)) return false;
      if (minCapacity && r.capacity < parseInt(minCapacity, 10)) return false;
      if (availableOnly && r.status !== "available") return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "capacity") return b.capacity - a.capacity;
      if (sortBy === "availability") {
        if (a.status === "available" && b.status !== "available") return -1;
        if (a.status !== "available" && b.status === "available") return 1;
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

  const roomsByFloor = visibleRooms.reduce((acc, room) => {
    const key = room.floor_name || "Unknown Floor";
    if (!acc[key]) acc[key] = [];
    acc[key].push(room);
    return acc;
  }, {});

  const floorNames = Object.keys(roomsByFloor).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ""), 10) || 0;
    const nb = parseInt(b.replace(/\D/g, ""), 10) || 0;
    return na - nb;
  });

  const activeFilterCount = selectedTypes.length + (minCapacity ? 1 : 0) + (availableOnly ? 1 : 0);

  const toggleType = (type) => {
    setSelectedTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };

  if (loading) {
    return (
      <div className="p-4 flex flex-col gap-4" style={{ maxWidth: 1000, margin: "0 auto" }}>
        <Skeleton height={18} className="w-32" />
        <Skeleton height={72} />
        <Skeleton height={40} />
        <Skeleton height={180} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col gap-3 items-center" style={{ maxWidth: 1000, margin: "0 auto", paddingTop: 64 }}>
        <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{error}</p>
        <div className="flex gap-2">
          <button onClick={fetchData} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Retry</button>
          <button onClick={() => navigate("/")} style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 18px", fontSize: 12, cursor: "pointer" }}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4" style={{ maxWidth: 1000, margin: "0 auto" }}>
      <nav>
        <Link to="/" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", transition: "color 150ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>
          \u2190 Campus Buildings
        </Link>
      </nav>

      {building && (
        <div className="rounded-xl p-4 flex items-start justify-between gap-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex flex-col gap-0.5">
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
              {building.name}
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {building.address} \u00b7 {building.total_floors} floor{building.total_floors !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-5 flex-shrink-0">
            <div className="text-right">
              <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", lineHeight: 1 }}>{building.room_count}</p>
              <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>rooms</p>
            </div>
            <div className="text-right">
              <p style={{
                fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)", lineHeight: 1,
                color: building.current_occupancy_pct > 0.7 ? "var(--danger)" : building.current_occupancy_pct > 0.4 ? "var(--warning)" : "var(--success)",
              }}>
                {Math.round(building.current_occupancy_pct * 100)}%
              </p>
              <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>occupied</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowFilters((v) => !v)}
            style={{
              background: activeFilterCount > 0 ? "var(--accent-muted)" : "var(--bg-card)",
              color: activeFilterCount > 0 ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${activeFilterCount > 0 ? "rgba(0,75,141,0.3)" : "var(--border)"}`,
              borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 150ms",
            }}>
            Filters
            {activeFilterCount > 0 && (
              <span style={{ background: "var(--accent)", color: "#fff", borderRadius: "50%", width: 15, height: 15, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          <button onClick={() => setAvailableOnly((v) => !v)}
            style={{
              background: availableOnly ? "rgba(0,75,141,0.1)" : "var(--bg-card)",
              color: availableOnly ? "var(--success)" : "var(--text-muted)",
              border: `1px solid ${availableOnly ? "rgba(0,75,141,0.3)" : "var(--border)"}`,
              borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", transition: "all 150ms",
            }}>
            Available now
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sort:</span>
            {[{ value: "name", label: "Name" }, { value: "capacity", label: "Capacity" }, { value: "availability", label: "Availability" }].map((opt) => (
              <button key={opt.value} onClick={() => setSortBy(opt.value)}
                style={{
                  background: sortBy === opt.value ? "var(--accent-muted)" : "transparent",
                  color: sortBy === opt.value ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${sortBy === opt.value ? "rgba(0,75,141,0.3)" : "var(--border)"}`,
                  borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", transition: "all 150ms",
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {showFilters && (
          <div className="rounded-xl p-3 flex flex-col gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex flex-col gap-1.5">
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Room Type</p>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_TYPE_OPTIONS.map(({ value, label }) => (
                  <button key={value} onClick={() => toggleType(value)}
                    style={{
                      background: selectedTypes.includes(value) ? "var(--accent-muted)" : "var(--bg-primary)",
                      color: selectedTypes.includes(value) ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${selectedTypes.includes(value) ? "rgba(0,75,141,0.3)" : "var(--border)"}`,
                      borderRadius: 20, padding: "3px 10px", fontSize: 11, cursor: "pointer", transition: "all 150ms",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Min Capacity</p>
              <input type="number" min="1" max="500" value={minCapacity} onChange={(e) => setMinCapacity(e.target.value)} placeholder="Any"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "var(--text-primary)", outline: "none", width: 72 }} />
              {activeFilterCount > 0 && (
                <button onClick={() => { setSelectedTypes([]); setMinCapacity(""); setAvailableOnly(false); }}
                  style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }}>
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {visibleRooms.length} room{visibleRooms.length !== 1 ? "s" : ""}{activeFilterCount > 0 ? " matching filters" : " total"}
      </p>

      <div className="flex flex-col gap-2">
        {floorNames.length === 0 && allRooms.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>No rooms listed</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Check back later or browse another building.</p>
          </div>
        ) : floorNames.length === 0 && allRooms.length > 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>No rooms match the current filters.</p>
            <button onClick={() => { setSelectedTypes([]); setMinCapacity(""); setAvailableOnly(false); }}
              style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Clear filters
            </button>
          </div>
        ) : (
          floorNames.map((floorName, i) => (
            <FloorSection
              key={floorName}
              floorName={floorName}
              rooms={roomsByFloor[floorName]}
              expandedRoomId={expandedRoomId}
              onRoomClick={handleRoomClick}
              onClosePanel={() => setExpandedRoomId(null)}
              onBook={handleBook}
              defaultOpen={i === 0}
            />
          ))
        )}
      </div>
    </div>
  );
}
