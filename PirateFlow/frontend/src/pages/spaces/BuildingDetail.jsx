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
    <div onClick={onClick} className={`floor-room-card${isSelected ? " selected" : ""}`}>
      <div className="floor-room-top">
        <h4 className="floor-room-name">{room.name}</h4>
        <span className="floor-room-status" style={{ color: status.color }}>
          <span className="floor-room-status-dot" style={{ background: status.color }} />
          {status.label}
        </span>
      </div>
      <div className="floor-room-info">
        <span className="floor-room-tag">{ROOM_TYPE_LABELS[room.room_type] || room.room_type}</span>
        <span className="floor-room-tag">&#x25EB; {room.capacity}</span>
        {room.hourly_rate && <span className="floor-room-tag">${room.hourly_rate}/hr</span>}
      </div>
      {room.equipment?.length > 0 && (
        <div className="floor-room-equip">
          {room.equipment.slice(0, 3).map((eq) => (
            <span key={eq} className="floor-room-equip-tag">{EQUIPMENT_ICONS[eq] || "\u00b7"} {eq.replace(/_/g, " ")}</span>
          ))}
          {room.equipment.length > 3 && <span className="floor-room-equip-tag">+{room.equipment.length - 3}</span>}
        </div>
      )}
    </div>
  );
}

function FloorSection({ floorName, rooms, expandedRoomId, onRoomClick, onClosePanel, onBook, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const availableCount = rooms.filter((r) => r.status === "available").length;
  return (
    <div className="floor-section">
      <button onClick={() => setOpen((v) => !v)} className="floor-section-header">
        <div className="floor-name">
          <span>{floorName}</span>
          <span className="badge-muted">{rooms.length} room{rooms.length !== 1 ? "s" : ""}</span>
          {availableCount > 0 && (
            <span className="floor-badges">{availableCount} available</span>
          )}
        </div>
        <span className={`floor-chevron${open ? " open" : ""}`}>{"\u25BE"}</span>
      </button>
      {open && (
        <div className="floor-room-grid">
          {rooms.length === 0 ? (
            <p className="empty-state" style={{ gridColumn: "1 / -1" }}>No rooms match the current filters.</p>
          ) : (
            rooms.map((room) => (
              <React.Fragment key={room.id}>
                <RoomCard room={room} isSelected={expandedRoomId === room.id} onClick={() => onRoomClick(room.id)} />
                {expandedRoomId === room.id && (
                  <RoomExpandedPanel roomId={room.id} onClose={onClosePanel} onBook={onBook} />
                )}
              </React.Fragment>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Skeleton({ height }) {
  return <div className="skeleton" style={{ height }} />;
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
      <div className="building-detail">
        <Skeleton height={18} />
        <Skeleton height={72} />
        <Skeleton height={40} />
        <Skeleton height={180} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="building-detail empty-state">
        <h3>{error}</h3>
        <div className="filter-bar">
          <button onClick={fetchData} className="btn btn-primary">Retry</button>
          <button onClick={() => navigate("/")} className="btn btn-secondary">Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="building-detail">
      <nav>
        <Link to="/" className="breadcrumb">
          {"\u2190"} Campus Buildings
        </Link>
      </nav>

      {building && (
        <div className="building-detail-header">
          <div>
            <h1 className="building-detail-name">
              {building.name}
            </h1>
            <p className="building-detail-meta">
              {building.address} {"\u00b7"} {building.total_floors} floor{building.total_floors !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="building-stats">
            <div className="building-stat">
              <p className="building-stat-value">{building.room_count}</p>
              <p className="building-stat-label">rooms</p>
            </div>
            <div className="building-stat">
              <p className="building-stat-value" style={{
                color: building.current_occupancy_pct > 0.7 ? "var(--danger)" : building.current_occupancy_pct > 0.4 ? "var(--warning)" : "var(--success)",
              }}>
                {Math.round(building.current_occupancy_pct * 100)}%
              </p>
              <p className="building-stat-label">occupied</p>
            </div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <button onClick={() => setShowFilters((v) => !v)} className={`filter-btn${activeFilterCount > 0 ? " active" : ""}`}>
          Filters
          {activeFilterCount > 0 && (
            <span className="filter-count">{activeFilterCount}</span>
          )}
        </button>

        <button onClick={() => setAvailableOnly((v) => !v)} className={`filter-btn${availableOnly ? " active" : ""}`}>
          Available now
        </button>

        <div className="sort-btns">
          <span className="sort-label">Sort:</span>
          {[{ value: "name", label: "Name" }, { value: "capacity", label: "Capacity" }, { value: "availability", label: "Availability" }].map((opt) => (
            <button key={opt.value} onClick={() => setSortBy(opt.value)} className={`sort-btn${sortBy === opt.value ? " active" : ""}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-section-label">Room Type</div>
          <div className="filter-pills">
            {ROOM_TYPE_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => toggleType(value)} className={`filter-pill${selectedTypes.includes(value) ? " active" : ""}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="filter-section-label">Min Capacity</div>
          <div className="filter-pills">
            <input type="number" min="1" max="500" value={minCapacity} onChange={(e) => setMinCapacity(e.target.value)} placeholder="Any" className="room-panel-date-input" />
            {activeFilterCount > 0 && (
              <button onClick={() => { setSelectedTypes([]); setMinCapacity(""); setAvailableOnly(false); }} className="btn btn-secondary">
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      <p className="building-detail-meta">
        {visibleRooms.length} room{visibleRooms.length !== 1 ? "s" : ""}{activeFilterCount > 0 ? " matching filters" : " total"}
      </p>

      <div>
        {floorNames.length === 0 && allRooms.length === 0 ? (
          <div className="empty-state">
            <h3>No rooms listed</h3>
            <p>Check back later or browse another building.</p>
          </div>
        ) : floorNames.length === 0 && allRooms.length > 0 ? (
          <div className="empty-state">
            <p>No rooms match the current filters.</p>
            <button onClick={() => { setSelectedTypes([]); setMinCapacity(""); setAvailableOnly(false); }} className="btn btn-primary">
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
