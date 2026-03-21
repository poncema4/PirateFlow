import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROOM_TYPE_LABELS = {
  study_room: "Study Room",
  computer_lab: "Computer Lab",
  lecture_hall: "Lecture Hall",
  science_lab: "Science Lab",
  conference_room: "Conference Room",
  event_space: "Event Space",
  multipurpose: "Multipurpose",
  classroom: "Classroom",
};

const ROOM_TYPE_OPTIONS = Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const EQUIPMENT_ICONS = {
  projector: "⊞",
  whiteboard: "▭",
  video_conferencing: "◎",
  smart_board: "◼",
  computers: "⌨",
  lab_equipment: "⚗",
  power_outlets: "⚡",
  recording_studio: "◉",
};

const STATUS_INFO = {
  available:   { label: "Available",   color: "var(--success)" },
  occupied:    { label: "Occupied",    color: "var(--danger)"  },
  maintenance: { label: "Maintenance", color: "var(--warning)" },
  closed:      { label: "Closed",      color: "var(--text-muted)" },
};

// ─── Room Card ────────────────────────────────────────────────────────────────
function RoomCard({ room, onClick }) {
  const status = STATUS_INFO[room.status] ?? STATUS_INFO.closed;

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 cursor-pointer flex flex-col gap-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        transition: "border-color 150ms, transform 150ms, box-shadow 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,200,150,0.3)";
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,200,150,0.07)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Room name + status */}
      <div className="flex items-start justify-between gap-2">
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
          {room.name}
        </h4>
        <span
          className="flex items-center gap-1 flex-shrink-0"
          style={{ fontSize: 11, color: status.color }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: status.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          {status.label}
        </span>
      </div>

      {/* Type + capacity */}
      <div className="flex items-center gap-3">
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--border)", color: "var(--text-muted)" }}
        >
          {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          ◫ {room.capacity} people
        </span>
        {room.hourly_rate && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ${room.hourly_rate}/hr
          </span>
        )}
      </div>

      {/* Equipment */}
      {room.equipment?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {room.equipment.slice(0, 3).map((eq) => (
            <span
              key={eq}
              style={{
                fontSize: 11,
                padding: "2px 7px",
                background: "var(--bg-primary)",
                borderRadius: 4,
                color: "var(--text-muted)",
              }}
            >
              {EQUIPMENT_ICONS[eq] || "·"} {eq.replace(/_/g, " ")}
            </span>
          ))}
          {room.equipment.length > 3 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 4px" }}>
              +{room.equipment.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Floor Section (accordion) ────────────────────────────────────────────────
function FloorSection({ floorName, rooms, buildingId, onRoomClick, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const availableCount = rooms.filter((r) => r.status === "available").length;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* Floor header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3"
        style={{
          background: "var(--bg-card)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 150ms",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-card)"; }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {floorName}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--border)", color: "var(--text-muted)" }}
          >
            {rooms.length} room{rooms.length !== 1 ? "s" : ""}
          </span>
          {availableCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(0,200,150,0.1)",
                color: "var(--success)",
                border: "1px solid rgba(0,200,150,0.2)",
              }}
            >
              {availableCount} available
            </span>
          )}
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: 12, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }}>
          ▾
        </span>
      </button>

      {/* Room grid */}
      {open && (
        <div
          className="grid gap-3 p-4"
          style={{
            background: "var(--bg-primary)",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          }}
        >
          {rooms.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0", gridColumn: "1 / -1" }}>
              No rooms match the current filters.
            </p>
          ) : (
            rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => onRoomClick(room.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ height, className = "" }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${className}`}
      style={{ height, background: "var(--bg-card)", border: "1px solid var(--border)" }}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BuildingDetail() {
  const { buildingId } = useParams();
  const navigate = useNavigate();

  const [building, setBuilding] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [minCapacity, setMinCapacity] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState("name");

  useEffect(() => {
    fetchData();
  }, [buildingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [buildingData, roomsData] = await Promise.all([
        api.getBuilding(buildingId),
        api.getRooms({ building_id: buildingId }),
      ]);
      setBuilding(buildingData.building);
      // Client-side filter by building name (stub doesn't filter server-side)
      const filtered = roomsData.items.filter(
        (r) => r.building_name === buildingData.building.name
      );
      setAllRooms(filtered);
    } catch {
      setError("Failed to load building details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Apply filters + sort
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
      return a.name.localeCompare(b.name); // default: name
    });

  // Group by floor, sort floor names
  const roomsByFloor = visibleRooms.reduce((acc, room) => {
    const key = room.floor_name || "Unknown Floor";
    if (!acc[key]) acc[key] = [];
    acc[key].push(room);
    return acc;
  }, {});

  // Build ordered floor list: floors with rooms first, sorted
  const floorNames = Object.keys(roomsByFloor).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ""), 10) || 0;
    const nb = parseInt(b.replace(/\D/g, ""), 10) || 0;
    return na - nb;
  });

  // Also show empty floors from the building def (if no rooms assigned)
  const allExpectedFloors = building
    ? Array.from({ length: building.total_floors }, (_, i) => `Floor ${i + 1}`)
    : [];
  const emptyFloors = allExpectedFloors.filter((f) => !roomsByFloor[f]);

  const activeFilterCount =
    selectedTypes.length + (minCapacity ? 1 : 0) + (availableOnly ? 1 : 0);

  const toggleType = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-6" style={{ maxWidth: 1000, margin: "0 auto" }}>
        <Skeleton height={20} className="w-32" />
        <Skeleton height={80} />
        <Skeleton height={48} />
        <Skeleton height={200} />
        <Skeleton height={200} />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-6 flex flex-col gap-4 items-center" style={{ maxWidth: 1000, margin: "0 auto", paddingTop: 80 }}>
        <p style={{ fontSize: 32 }}>◻</p>
        <p style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 600 }}>{error}</p>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Retry
          </button>
          <button
            onClick={() => navigate("/spaces")}
            style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}
          >
            Back to Spaces
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 flex flex-col gap-6" style={{ maxWidth: 1000, margin: "0 auto" }}>

      {/* Breadcrumb */}
      <nav>
        <Link
          to="/spaces"
          style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", transition: "color 150ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          ← Campus Spaces
        </Link>
      </nav>

      {/* Building header */}
      {building && (
        <div
          className="rounded-xl p-5 flex items-start justify-between gap-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex flex-col gap-1">
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
              }}
            >
              {building.name}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {building.address} · {building.total_floors} floor{building.total_floors !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-6 flex-shrink-0">
            <div className="text-right">
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", lineHeight: 1 }}>
                {building.room_count}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>total rooms</p>
            </div>
            <div className="text-right">
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  lineHeight: 1,
                  color: building.current_occupancy_pct > 0.7
                    ? "var(--danger)"
                    : building.current_occupancy_pct > 0.4
                    ? "var(--warning)"
                    : "var(--success)",
                }}
              >
                {Math.round(building.current_occupancy_pct * 100)}%
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>occupied</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter + sort bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              background: activeFilterCount > 0 ? "var(--accent-muted)" : "var(--bg-card)",
              color: activeFilterCount > 0 ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${activeFilterCount > 0 ? "rgba(0,200,150,0.3)" : "var(--border)"}`,
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 150ms",
            }}
          >
            ⚙ Filters
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: "var(--accent)",
                  color: "#000",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Available-only quick toggle */}
          <button
            onClick={() => setAvailableOnly((v) => !v)}
            style={{
              background: availableOnly ? "rgba(0,200,150,0.1)" : "var(--bg-card)",
              color: availableOnly ? "var(--success)" : "var(--text-muted)",
              border: `1px solid ${availableOnly ? "rgba(0,200,150,0.3)" : "var(--border)"}`,
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 13,
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            ● Available now
          </button>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sort:</span>
            {[
              { value: "name", label: "Name" },
              { value: "capacity", label: "Capacity" },
              { value: "availability", label: "Availability" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                style={{
                  background: sortBy === opt.value ? "var(--accent-muted)" : "transparent",
                  color: sortBy === opt.value ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${sortBy === opt.value ? "rgba(0,200,150,0.3)" : "var(--border)"}`,
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 150ms",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div
            className="rounded-xl p-4 flex flex-col gap-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* Room type pills */}
            <div className="flex flex-col gap-2">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Room Type
              </p>
              <div className="flex flex-wrap gap-2">
                {ROOM_TYPE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => toggleType(value)}
                    style={{
                      background: selectedTypes.includes(value) ? "var(--accent-muted)" : "var(--bg-primary)",
                      color: selectedTypes.includes(value) ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${selectedTypes.includes(value) ? "rgba(0,200,150,0.3)" : "var(--border)"}`,
                      borderRadius: 20,
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 150ms",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Min capacity */}
            <div className="flex items-center gap-3">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                Min Capacity
              </p>
              <input
                type="number"
                min="1"
                max="500"
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
                placeholder="Any"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  outline: "none",
                  width: 80,
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              />
              {(selectedTypes.length > 0 || minCapacity || availableOnly) && (
                <button
                  onClick={() => { setSelectedTypes([]); setMinCapacity(""); setAvailableOnly(false); }}
                  style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results summary */}
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {visibleRooms.length} room{visibleRooms.length !== 1 ? "s" : ""}
        {activeFilterCount > 0 ? " matching filters" : " total"}
      </p>

      {/* Floor sections */}
      <div className="flex flex-col gap-3">
        {floorNames.length === 0 && allRooms.length === 0 ? (
          // No rooms at all in this building
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p style={{ fontSize: 32, marginBottom: 12 }}>◻</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              No rooms listed for this building
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Check back later or browse another building.
            </p>
          </div>
        ) : floorNames.length === 0 && allRooms.length > 0 ? (
          // Rooms exist but all filtered out
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>
              No rooms match the current filters.
            </p>
            <button
              onClick={() => { setSelectedTypes([]); setMinCapacity(""); setAvailableOnly(false); }}
              style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {floorNames.map((floorName, i) => (
              <FloorSection
                key={floorName}
                floorName={floorName}
                rooms={roomsByFloor[floorName]}
                buildingId={buildingId}
                onRoomClick={(roomId) => navigate(`/spaces/${buildingId}/${roomId}`)}
                defaultOpen={i === 0}
              />
            ))}
            {/* Empty floors (no rooms assigned in stub) */}
            {activeFilterCount === 0 && emptyFloors.map((floorName) => (
              <div
                key={floorName}
                className="rounded-xl px-5 py-3 flex items-center justify-between"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
                  {floorName}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No rooms listed</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
