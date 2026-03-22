import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { ROOM_TYPE_LABELS, EQUIPMENT_LABELS } from "../../constants/rooms";
import TopBar from "../../components/common/TopBar";

const TYPE_COLORS = {
  study_room:      { bg: "#eff6ff", tag: "rgba(37,99,235,.1)",  color: "#2563eb" },
  computer_lab:    { bg: "#f0fdf4", tag: "rgba(22,163,74,.1)",  color: "#16a34a" },
  lecture_hall:    { bg: "#fefce8", tag: "rgba(202,138,4,.1)",   color: "#ca8a04" },
  science_lab:     { bg: "#ecfdf5", tag: "rgba(5,150,105,.1)",  color: "#059669" },
  conference_room: { bg: "#fef2f2", tag: "rgba(220,38,38,.1)",  color: "#dc2626" },
  classroom:       { bg: "#eff6ff", tag: "rgba(37,99,235,.1)",  color: "#2563eb" },
  event_space:     { bg: "#fefce8", tag: "rgba(202,138,4,.1)",  color: "#ca8a04" },
  multipurpose:    { bg: "#f0fdf4", tag: "rgba(22,163,74,.1)",  color: "#16a34a" },
};

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
  const tc = TYPE_COLORS[room.room_type] || TYPE_COLORS.classroom;
  const available = room.status === "available";
  const bookable = room.is_bookable && room.status !== "maintenance" && room.status !== "closed";

  return (
    <div
      onClick={() => onClick(room)}
      className={`room-card ${!bookable ? "disabled" : ""}`}
    >
      {/* Type header */}
      <div
        className="room-card-type"
        style={{ background: tc.bg }}
      >
        <span
          className="room-card-type-badge"
          style={{ background: tc.tag, color: tc.color }}
        >
          {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
        </span>
        <span
          title={available ? "Available now" : "Unavailable"}
          className="room-card-status-dot"
          style={{
            background: available ? "var(--success)" : "var(--danger)",
            boxShadow: available
              ? "0 0 0 3px rgba(58,138,82,.18)"
              : "0 0 0 3px rgba(176,48,48,.18)",
          }}
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
              <span
                key={eq}
                className="room-card-equip-tag"
              >
                {EQUIPMENT_LABELS[eq] || eq.replace(/_/g, " ")}
              </span>
            ))}
            {room.equipment.length > 4 && (
              <span className="room-card-equip-tag" style={{ background: 'transparent', padding: '0 4px' }}>
                +{room.equipment.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="room-card-footer">
        {bookable ? (
          <>
            <span className="room-card-avail">
              {available
                ? <><span className="room-card-avail-dot" style={{ background: 'var(--success)' }} />Available now</>
                : <><span className="room-card-avail-dot" style={{ background: 'var(--warning)' }} />In use</>
              }
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onBook(room); }}
              className="room-card-book-btn"
            >
              Book Now
            </button>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
            {room.status === "maintenance" ? "Under maintenance" : "Unavailable"}
          </span>
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

  const filters = ["All", ...new Set(Object.values(ROOM_TYPE_LABELS))];

  useEffect(() => {
    api.getRooms({})
      .then((data) => setRooms(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = rooms.filter((r) => {
    if (filter !== "All") {
      const label = ROOM_TYPE_LABELS[r.room_type] || r.room_type;
      if (label !== filter) return false;
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
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
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
        <div className="landing-search-bar">
          {/* Search */}
          <div className="landing-search-input">
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
          <div className="landing-divider hide-mobile" />

          {/* Filter pills */}
          <div className="landing-filters">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`landing-filter-btn ${filter === f ? "active" : ""}`}
              >
                {f === "All" ? "All Spaces" : f}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <div className="landing-results">
            <p>
              Showing <span>{visible.length}</span> {visible.length === 1 ? "space" : "spaces"}
              {filter !== "All" && <> in <span>{filter}</span></>}
              {search && <> matching &ldquo;<span>{search}</span>&rdquo;</>}
            </p>
          </div>
        )}

        {/* Room grid */}
        {loading ? (
          <div className="room-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{ borderRadius: 16, overflow: 'hidden', animation: 'pulse 1.5s ease-in-out infinite' }}
              >
                <div style={{ height: 56, background: 'var(--cream-dk)' }} />
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: 20 }}>
                  <div style={{ height: 12, background: 'var(--cream-dk)', borderRadius: 4, width: '33%', marginBottom: 12 }} />
                  <div style={{ height: 20, background: 'var(--cream-dk)', borderRadius: 4, width: '66%', marginBottom: 12 }} />
                  <div style={{ height: 12, background: 'var(--cream-dk)', borderRadius: 4, width: '50%', marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <div style={{ height: 24, background: 'var(--cream-dk)', borderRadius: 8, width: 64 }} />
                    <div style={{ height: 24, background: 'var(--cream-dk)', borderRadius: 8, width: 80 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div style={{ opacity: 0.3, marginBottom: 16 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>
              No spaces found
            </p>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>
              Try adjusting your filters or search terms.
            </p>
            <button
              onClick={() => { setSearch(""); setFilter("All"); }}
              style={{ fontSize: 14, color: 'var(--shu-blue)', fontWeight: 500, cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: 'var(--font-body)' }}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="room-grid" style={{ marginBottom: 48 }}>
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
