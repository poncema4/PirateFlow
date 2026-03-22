import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { ROOM_TYPE_LABELS, EQUIPMENT_LABELS } from "../../constants/rooms";
import TopBar from "../../components/common/TopBar";

/* ─── Search Icon SVG ────────────────────────────────────────────────── */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/* ─── Room Card ──────────────────────────────────────────────────────── */
function RoomCard({ room, onClick, onBook }) {
  const available = room.status === "available";
  const underMaintenance = room.status === "maintenance";

  return (
    <div
      onClick={() => onClick(room)}
      className={`room-card${underMaintenance ? " disabled" : ""}`}
    >
      {/* Type header */}
      <div className="room-card-type">
        <span className="room-card-type-badge">
          {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
        </span>
        <span
          title={available ? "Available now" : "Unavailable"}
          className={`room-card-status-dot${available ? " available" : " unavailable"}`}
        />
      </div>

      {/* Body */}
      <div className="room-card-body">
        <p className="room-card-building">
          {room.building_name}{room.floor_name ? ` \u00B7 ${room.floor_name}` : ""}
        </p>
        <h3 className="room-card-name">
          {room.name}
        </h3>
        <div className="room-card-capacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Capacity: {room.capacity}</span>
        </div>
        {room.equipment?.length > 0 && (
          <div className="room-card-equipment">
            {room.equipment.slice(0, 4).map(eq => (
              <span key={eq} className="room-card-equip-tag">
                {EQUIPMENT_LABELS[eq] || eq.replace(/_/g, " ")}
              </span>
            ))}
            {room.equipment.length > 4 && (
              <span className="room-card-equip-tag">
                +{room.equipment.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="room-card-footer">
        {underMaintenance ? (
          <span className="room-card-avail">Under maintenance</span>
        ) : (
          <>
            <span className="room-card-avail">
              {available
                ? <><span className="room-card-avail-dot available" />Available now</>
                : <><span className="room-card-avail-dot in-use" />In use</>
              }
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onBook(room); }}
              className="room-card-book-btn"
            >
              Book Now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Landing Page ───────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [buildingFilter, setBuildingFilter] = useState("All");

  const filters = ["All", ...new Set(Object.values(ROOM_TYPE_LABELS))];
  const buildingNames = ["All", ...new Set(rooms.map((r) => r.building_name).filter(Boolean).sort())];

  useEffect(() => {
    api.getRooms({ page_size: 200 })
      .then((data) => setRooms(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = rooms.filter((r) => {
    if (filter !== "All") {
      const label = ROOM_TYPE_LABELS[r.room_type] || r.room_type;
      if (label !== filter) return false;
    }
    if (buildingFilter !== "All") {
      if (r.building_name !== buildingFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (
        !(r.name || "").toLowerCase().includes(q) &&
        !(r.building_name || "").toLowerCase().includes(q) &&
        !(ROOM_TYPE_LABELS[r.room_type] || "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const handleBook = (room) => {
    const url = `/bookings/new?roomId=${room.id}&roomName=${encodeURIComponent(room.name)}`;
    if (user) {
      navigate(url);
    } else {
      navigate("/login", { state: { from: { pathname: url } } });
    }
  };

  const today = new Date();
  const availableCount = rooms.filter(r => r.status === "available").length;

  return (
    <div className="landing-page">
      <TopBar />

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-content">
            <div>
              <p className="landing-hero-date">
                {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
              <h1>
                Find & Reserve a Space
              </h1>
              <p>
                Browse available rooms across campus. Select a space to check availability and book it instantly.
              </p>
            </div>
            {!loading && (
              <div className="landing-hero-stats">
                <div className="landing-hero-stat">
                  <div className="landing-hero-stat-value">{rooms.length}</div>
                  <div className="landing-hero-stat-label">Total Spaces</div>
                </div>
                <div className="landing-hero-divider" />
                <div className="landing-hero-stat">
                  <div className="landing-hero-stat-value available">{availableCount}</div>
                  <div className="landing-hero-stat-label">Available Now</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="landing-main">
        {/* Search & Filters Bar */}
        <div className="landing-toolbar">
          {/* Search */}
          <div className="landing-search">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms, buildings, or types..."
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="landing-search-clear"
              >
                &times;
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="landing-divider" />

          {/* Room type filter pills */}
          <div className="landing-filters">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`landing-filter-btn${filter === f ? " active" : ""}`}
              >
                {f === "All" ? "All Types" : f}
              </button>
            ))}
          </div>

          {/* Building filter pills */}
          {buildingNames.length > 2 && (
            <>
              <div className="landing-divider" />
              <div className="landing-filters">
                {buildingNames.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBuildingFilter(b)}
                    className={`landing-filter-btn${buildingFilter === b ? " active" : ""}`}
                  >
                    {b === "All" ? "All Buildings" : b}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Results count */}
        {!loading && (
          <div className="landing-results">
            <p>
              Showing <span>{visible.length}</span> {visible.length === 1 ? "space" : "spaces"}
              {filter !== "All" && <> in <span>{filter}</span></>}
              {buildingFilter !== "All" && <> in <span>{buildingFilter}</span></>}
              {search && <> matching &ldquo;<span>{search}</span>&rdquo;</>}
            </p>
          </div>
        )}

        {/* Room grid */}
        {loading ? (
          <div className="room-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton" style={{ height: 260 }} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h3>No spaces found</h3>
            <p>Try adjusting your filters or search terms.</p>
            <button
              onClick={() => { setSearch(""); setFilter("All"); setBuildingFilter("All"); }}
              className="btn-primary"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="room-grid">
            {visible.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={handleBook}
                onBook={handleBook}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
