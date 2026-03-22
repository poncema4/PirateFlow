import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { ROOM_TYPE_LABELS, EQUIPMENT_LABELS } from "../../constants/rooms";
import TopBar from "../../components/common/TopBar";

const TYPE_COLORS = {
  study_room:      { bg: "#eef2f8", tag: "rgba(0,75,141,.12)",  color: "#004B8D" },
  computer_lab:    { bg: "#eef5f2", tag: "rgba(45,106,74,.12)", color: "#1d5c42" },
  lecture_hall:    { bg: "#f7f2e8", tag: "rgba(120,80,20,.12)", color: "#7a5012" },
  science_lab:     { bg: "#eef4f0", tag: "rgba(40,90,60,.12)",  color: "#285a3c" },
  conference_room: { bg: "#f7eef0", tag: "rgba(120,40,50,.12)", color: "#7a2832" },
  classroom:       { bg: "#eef2f8", tag: "rgba(0,75,141,.12)",  color: "#004B8D" },
  event_space:     { bg: "#f7f2e8", tag: "rgba(120,80,20,.12)", color: "#7a5012" },
  multipurpose:    { bg: "#eef5f2", tag: "rgba(45,106,74,.12)", color: "#1d5c42" },
};

/* ─── Search Icon SVG ────────────────────────────────────────────────── */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
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
      className={`
        bg-card border border-border rounded-2xl overflow-hidden cursor-pointer
        flex flex-col transition-all duration-200 ease-out
        hover:-translate-y-1.5 hover:shadow-xl hover:border-border-hover
        animate-[fadeUp_.4s_ease_both]
        ${bookable ? "opacity-100" : "opacity-50"}
      `}
    >
      {/* Type header */}
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ background: tc.bg }}
      >
        <span
          className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
          style={{ background: tc.tag, color: tc.color }}
        >
          {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
        </span>
        <span
          title={available ? "Available now" : "Unavailable"}
          className={`w-2.5 h-2.5 rounded-full ${
            available ? "bg-success" : "bg-danger"
          }`}
          style={{
            boxShadow: available
              ? "0 0 0 3px rgba(58,138,82,.18)"
              : "0 0 0 3px rgba(176,48,48,.18)",
          }}
        />
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted font-medium mb-1.5">
          {room.building_name}{room.floor_name ? ` \u00B7 ${room.floor_name}` : ""}
        </p>
        <h3 className="font-display text-lg font-bold text-navy mb-2 leading-snug">
          {room.name}
        </h3>
        <div className="flex items-center gap-2 text-[13px] text-muted mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Capacity: {room.capacity}</span>
        </div>
        {room.equipment?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {room.equipment.slice(0, 4).map(eq => (
              <span
                key={eq}
                className="text-[11px] bg-cream text-muted px-2.5 py-1 rounded-lg font-medium"
              >
                {EQUIPMENT_LABELS[eq] || eq.replace(/_/g, " ")}
              </span>
            ))}
            {room.equipment.length > 4 && (
              <span className="text-[11px] text-muted px-2 py-1 font-medium">
                +{room.equipment.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-cream-dk flex items-center justify-between">
        {bookable ? (
          <>
            <span className="text-[12px] text-muted">
              {available
                ? <><span className="inline-block w-1.5 h-1.5 rounded-full bg-success mr-1.5 relative top-[-1px]" />Available now</>
                : <><span className="inline-block w-1.5 h-1.5 rounded-full bg-warning mr-1.5 relative top-[-1px]" />In use</>
              }
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onBook(room); }}
              className="
                text-[12px] font-semibold text-shu-blue px-4 py-1.5
                border border-shu-blue rounded-lg bg-transparent cursor-pointer
                transition-all duration-200 tracking-wide font-body
                hover:bg-shu-blue hover:text-white
              "
            >
              Book Now
            </button>
          </>
        ) : (
          <span className="text-[12px] text-danger font-medium">
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
    <div className="min-h-screen bg-cream">
      <TopBar />

      {/* Hero Section */}
      <section className="bg-shu-blue-dk text-white">
        <div className="max-w-6xl mx-auto px-8 py-12 pb-14">
          <div className="flex items-end justify-between flex-wrap gap-6">
            <div>
              <p className="text-white/50 text-sm font-medium tracking-wider uppercase mb-2">
                {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
              <h1 className="font-display text-4xl font-bold leading-tight mb-3">
                Find & Reserve a Space
              </h1>
              <p className="text-white/65 text-base max-w-xl leading-relaxed">
                Browse available rooms across campus. Select a space to check availability and book it instantly.
              </p>
            </div>
            {!loading && (
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold font-display">{rooms.length}</div>
                  <div className="text-xs text-white/50 mt-0.5">Total Spaces</div>
                </div>
                <div className="w-px bg-white/15" />
                <div className="text-center">
                  <div className="text-3xl font-bold font-display text-green-300">{availableCount}</div>
                  <div className="text-xs text-white/50 mt-0.5">Available Now</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-8 -mt-6">
        {/* Search & Filters Bar */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-md mb-8 flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex items-center bg-cream border border-border rounded-xl px-4 py-2.5 flex-1 min-w-[240px]">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms, buildings, or types..."
              className="border-none outline-none bg-transparent text-sm font-body text-navy ml-3 w-full placeholder:text-muted/60"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-muted hover:text-navy cursor-pointer bg-transparent border-none text-lg leading-none px-1"
              >
                &times;
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-border hidden md:block" />

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  px-4 py-2 rounded-xl text-[13px] font-medium cursor-pointer
                  whitespace-nowrap transition-all duration-200 font-body border
                  ${filter === f
                    ? "border-shu-blue bg-shu-blue text-white shadow-sm"
                    : "border-border bg-white text-muted hover:border-border-hover hover:text-navy"
                  }
                `}
              >
                {f === "All" ? "All Spaces" : f}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-muted">
              Showing <span className="font-semibold text-navy">{visible.length}</span> {visible.length === 1 ? "space" : "spaces"}
              {filter !== "All" && <> in <span className="font-semibold text-navy">{filter}</span></>}
              {search && <> matching &ldquo;<span className="font-semibold text-navy">{search}</span>&rdquo;</>}
            </p>
          </div>
        )}

        {/* Room grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl overflow-hidden"
              >
                <div className="h-14 bg-cream-dk" />
                <div className="bg-card border border-border border-t-0 rounded-b-2xl p-5 space-y-3">
                  <div className="h-3 bg-cream-dk rounded w-1/3" />
                  <div className="h-5 bg-cream-dk rounded w-2/3" />
                  <div className="h-3 bg-cream-dk rounded w-1/2" />
                  <div className="flex gap-2 mt-2">
                    <div className="h-6 bg-cream-dk rounded-lg w-16" />
                    <div className="h-6 bg-cream-dk rounded-lg w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-16 text-center">
            <div className="text-4xl mb-4 opacity-30">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <p className="font-display text-lg font-semibold text-navy mb-2">
              No spaces found
            </p>
            <p className="text-sm text-muted mb-4">
              Try adjusting your filters or search terms.
            </p>
            <button
              onClick={() => { setSearch(""); setFilter("All"); }}
              className="text-sm text-shu-blue font-medium cursor-pointer bg-transparent border-none hover:underline font-body"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
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
