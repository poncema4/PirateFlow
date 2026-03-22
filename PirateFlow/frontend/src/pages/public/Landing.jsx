import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { ROOM_TYPE_LABELS, EQUIPMENT_LABELS } from "../../constants/rooms";
import TopBar from "../../components/common/TopBar";

const TYPE_COLORS = {
  study_room:      { bg: "#eef2f8", tag: "rgba(0,75,141,.1)",  color: "#004B8D" },
  computer_lab:    { bg: "#eef5f2", tag: "rgba(45,106,74,.1)", color: "#1d5c42" },
  lecture_hall:    { bg: "#f7f2e8", tag: "rgba(120,80,20,.1)", color: "#7a5012" },
  science_lab:     { bg: "#eef4f0", tag: "rgba(40,90,60,.1)",  color: "#285a3c" },
  conference_room: { bg: "#f7eef0", tag: "rgba(120,40,50,.1)", color: "#7a2832" },
  classroom:       { bg: "#eef2f8", tag: "rgba(0,75,141,.1)",  color: "#004B8D" },
  event_space:     { bg: "#f7f2e8", tag: "rgba(120,80,20,.1)", color: "#7a5012" },
  multipurpose:    { bg: "#eef5f2", tag: "rgba(45,106,74,.1)", color: "#1d5c42" },
};

function RoomCard({ room, onClick, onBook }) {
  const tc = TYPE_COLORS[room.room_type] || TYPE_COLORS.classroom;
  const available = room.status === "available";
  const bookable = room.is_bookable && room.status !== "maintenance" && room.status !== "closed";

  return (
    <div
      onClick={() => onClick(room)}
      className={`bg-card border border-border rounded-xl overflow-hidden cursor-pointer
        transition-all duration-200 ease-out flex flex-col animate-[fadeUp_.4s_ease_both]
        hover:-translate-y-1 hover:shadow-lg hover:border-border-hover
        ${bookable ? "opacity-100" : "opacity-60"}`}
    >
      {/* Colored type header */}
      <div
        className="h-13 px-4 py-3 flex items-start justify-between"
        style={{ background: tc.bg }}
      >
        <span
          className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
          style={{ background: tc.tag, color: tc.color }}
        >
          {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
        </span>
        <span
          title={available ? "Available" : "Unavailable"}
          className={`w-2.5 h-2.5 rounded-full mt-1 ${
            available
              ? "bg-success shadow-[0_0_0_2px_rgba(58,138,82,.2)]"
              : "bg-danger shadow-[0_0_0_2px_rgba(176,48,48,.2)]"
          }`}
        />
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">
          {room.building_name}{room.floor_name ? ` \u00B7 ${room.floor_name}` : ""}
        </p>
        <h3 className="font-display text-lg font-bold text-navy mb-1.5 leading-tight">
          {room.name}
        </h3>
        <p className="text-xs text-muted mb-2">
          {"Cap. " + room.capacity}
          {room.equipment?.slice(0, 2).map(eq =>
            ` \u00B7 ${EQUIPMENT_LABELS[eq] || eq.replace(/_/g, " ")}`
          )}
        </p>
        {room.equipment?.length > 2 && (
          <div className="flex flex-wrap gap-1.5">
            {room.equipment.slice(2).map(eq => (
              <span
                key={eq}
                className="text-[10px] bg-cream text-muted px-2.5 py-0.5 rounded-md font-medium"
              >
                {EQUIPMENT_LABELS[eq] || eq.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-cream-dk flex items-center justify-between">
        {bookable ? (
          <>
            <span className="text-[11px] text-muted font-serif">
              {available
                ? <>Status: <strong className="text-success font-semibold">Available</strong></>
                : "Currently occupied"
              }
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onBook(room); }}
              className="text-[11px] font-semibold text-shu-blue px-3.5 py-1 border border-shu-blue
                rounded-md bg-transparent cursor-pointer transition-all duration-200
                tracking-wide font-body hover:bg-shu-blue hover:text-white"
            >
              Book
            </button>
          </>
        ) : (
          <span className="text-[11px] text-danger font-medium">
            {room.status === "maintenance" ? "Under maintenance" : "Unavailable"}
          </span>
        )}
      </div>
    </div>
  );
}

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

  return (
    <div className="min-h-screen bg-cream">
      <TopBar />

      <main className="max-w-5xl mx-auto px-7 py-6">
        {/* Page header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <h1 className="font-display text-3xl font-bold text-navy leading-tight">
              Reserve a Space
            </h1>
            <p className="font-serif text-sm text-muted mt-1 font-light">
              Select a room to view availability and confirm your booking.
            </p>
            <div className="w-8 h-0.5 bg-shu-blue mt-2.5" />
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-semibold text-navy underline underline-offset-4">
              {today.toLocaleDateString("en-US", { weekday: "long" })}
            </div>
            <div className="text-xs text-muted mt-0.5">
              {today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap
                transition-all duration-200 font-body border
                ${filter === f
                  ? "border-shu-blue bg-shu-blue text-white"
                  : "border-border bg-card text-muted hover:border-border-hover"
                }`}
            >
              {f === "All" ? "All Spaces" : f}
            </button>
          ))}
          <div className="flex-1 min-w-3" />
          <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-1.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or building..."
              className="border-none outline-none bg-transparent text-xs font-body text-navy w-48"
            />
          </div>
        </div>

        {/* Room grid */}
        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse h-56 bg-card border border-border rounded-xl"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <p className="font-display text-base font-semibold text-navy mb-1">
              No rooms found
            </p>
            <p className="text-sm text-muted">
              Try adjusting your filters or search terms.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 mb-8">
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
