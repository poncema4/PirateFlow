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
      style={{
        background: "#fff",
        border: "1px solid #ddd5c4",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all .22s cubic-bezier(.4,0,.2,1)",
        display: "flex",
        flexDirection: "column",
        animation: "fadeUp .4s ease both",
        opacity: bookable ? 1 : 0.6,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,75,141,.14)";
        e.currentTarget.style.borderColor = "#c0b09a";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "#ddd5c4";
      }}
    >
      {/* Colored type header */}
      <div style={{
        height: 52,
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        background: tc.bg,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: ".12em",
          padding: "3px 9px", borderRadius: 10,
          background: tc.tag, color: tc.color,
        }}>
          {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
        </span>
        <span
          title={available ? "Available" : "Unavailable"}
          style={{
            width: 9, height: 9,
            borderRadius: "50%",
            marginTop: 3,
            background: available ? "#3a8a52" : "#b03030",
            boxShadow: `0 0 0 2px ${available ? "rgba(58,138,82,.2)" : "rgba(176,48,48,.2)"}`,
          }}
        />
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px", flex: 1 }}>
        <p style={{
          fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em",
          color: "#7a6a52", fontWeight: 500, marginBottom: 4,
        }}>
          {room.building_name}{room.floor_name ? ` · ${room.floor_name}` : ""}
        </p>
        <h3 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 17, fontWeight: 700, color: "#1b2f4e",
          marginBottom: 6, lineHeight: 1.2,
        }}>
          {room.name}
        </h3>
        <p style={{ fontSize: 12, color: "#7a6a52", marginBottom: 8 }}>
          {"Cap. " + room.capacity}
          {room.equipment?.slice(0, 2).map(eq =>
            ` · ${EQUIPMENT_LABELS[eq] || eq.replace(/_/g, " ")}`
          )}
        </p>
        {room.equipment?.length > 2 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {room.equipment.slice(2).map(eq => (
              <span key={eq} style={{
                fontSize: 10, background: "#f8f4ec", color: "#7a6a52",
                padding: "3px 9px", borderRadius: 8, fontWeight: 500,
              }}>
                {EQUIPMENT_LABELS[eq] || eq.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 16px",
        borderTop: "1px solid #ede8dc",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        {bookable ? (
          <>
            <span style={{ fontSize: 11, color: "#7a6a52", fontFamily: "'Source Serif 4', Georgia, serif" }}>
              {available
                ? <>{`Status: `}<strong style={{ color: "#2d6a4a", fontWeight: 600 }}>Available</strong></>
                : "Currently occupied"
              }
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onBook(room); }}
              style={{
                fontSize: 11, fontWeight: 600,
                color: "#004B8D",
                padding: "5px 13px",
                border: "1px solid #004B8D",
                borderRadius: 6,
                background: "transparent",
                cursor: "pointer",
                transition: "all .22s cubic-bezier(.4,0,.2,1)",
                letterSpacing: ".03em",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#004B8D"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#004B8D"; }}
            >
              Book
            </button>
          </>
        ) : (
          <span style={{ fontSize: 11, color: "#8b2a2a", fontWeight: 500 }}>
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
    <div style={{ minHeight: "100vh", background: "#f8f4ec" }}>
      <TopBar />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px" }}>
        {/* Page header */}
        <div style={{
          display: "flex", alignItems: "flex-end",
          justifyContent: "space-between", marginBottom: 28,
          flexWrap: "wrap", gap: 16,
        }}>
          <div>
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 28, fontWeight: 700, color: "#1b2f4e", lineHeight: 1.1,
            }}>
              Reserve a Space
            </h1>
            <p style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 14, color: "#7a6a52", marginTop: 4, fontWeight: 300,
            }}>
              Select a room to view availability and confirm your booking.
            </p>
            <div style={{ width: 32, height: 2, background: "#004B8D", marginTop: 10 }} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 18, fontWeight: 600, color: "#1b2f4e",
              textDecoration: "underline", textUnderlineOffset: 3,
            }}>
              {today.toLocaleDateString("en-US", { weekday: "long" })}
            </div>
            <div style={{ fontSize: 12, color: "#7a6a52", marginTop: 2 }}>
              {today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 22, flexWrap: "wrap",
        }}>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "7px 16px", borderRadius: 20,
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                whiteSpace: "nowrap",
                border: `1px solid ${filter === f ? "#004B8D" : "#ddd5c4"}`,
                background: filter === f ? "#004B8D" : "#fff",
                color: filter === f ? "#fff" : "#7a6a52",
                transition: "all .22s cubic-bezier(.4,0,.2,1)",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {f === "All" ? "All Spaces" : f}
            </button>
          ))}
          <div style={{ flex: 1, minWidth: 10 }} />
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fff", border: "1px solid #ddd5c4",
            borderRadius: 20, padding: "7px 16px",
          }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or building..."
              style={{
                border: "none", outline: "none", background: "transparent",
                fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif",
                color: "#1b2f4e", width: 200,
              }}
            />
          </div>
        </div>

        {/* Room grid */}
        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  height: 240, background: "#fff",
                  border: "1px solid #ddd5c4", borderRadius: 14,
                }}
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div style={{
            background: "#fff", border: "1px solid #ddd5c4",
            borderRadius: 14, padding: 48, textAlign: "center",
          }}>
            <p style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 16, fontWeight: 600, color: "#1b2f4e", marginBottom: 4,
            }}>
              No rooms found
            </p>
            <p style={{ fontSize: 13, color: "#7a6a52" }}>
              Try adjusting your filters or search terms.
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16, marginBottom: 32,
          }}>
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
