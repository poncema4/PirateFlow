import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../App";

// ─── Constants ────────────────────────────────────────────────────────────────
const SEARCH_SUGGESTIONS = [
  "Study rooms available now",
  "Large lecture halls",
  "Rooms with video conferencing",
  "Computer labs this afternoon",
];

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getOccupancyInfo(pct) {
  // pct is 0.0–1.0
  if (pct < 0.4) return { label: "Low", color: "var(--success)" };
  if (pct < 0.7) return { label: "Moderate", color: "var(--warning)" };
  return { label: "High", color: "var(--danger)" };
}

function getConfidenceInfo(score) {
  if (score >= 0.8) return { label: "High match", color: "var(--success)" };
  if (score >= 0.6) return { label: "Good match", color: "var(--warning)" };
  return { label: "Partial match", color: "var(--text-muted)" };
}

// ─── Building Grid Card ───────────────────────────────────────────────────────
function BuildingGridCard({ building, onClick }) {
  const occ = getOccupancyInfo(building.current_occupancy_pct);
  const availableRooms = Math.round(building.room_count * (1 - building.current_occupancy_pct));

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-5 cursor-pointer flex flex-col gap-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        transition: "border-color 150ms, transform 150ms, box-shadow 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,200,150,0.3)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,200,150,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            {building.name}
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {building.address} · {building.total_floors} floors
          </p>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
          style={{
            background: occ.color + "18",
            color: occ.color,
            border: `1px solid ${occ.color}33`,
          }}
        >
          {occ.label}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        <div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", lineHeight: 1 }}>
            {availableRooms}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>available</p>
        </div>
        <div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", lineHeight: 1 }}>
            {building.room_count}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>total rooms</p>
        </div>
      </div>

      {/* Occupancy bar */}
      <div>
        <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.round(building.current_occupancy_pct * 100)}%`,
              background: occ.color,
              borderRadius: 2,
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {Math.round(building.current_occupancy_pct * 100)}% occupied
        </p>
      </div>

      <p style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>
        View rooms →
      </p>
    </div>
  );
}

// ─── AI Search Result Card ────────────────────────────────────────────────────
function SearchResultCard({ result, onBook }) {
  const conf = getConfidenceInfo(result.confidence);
  const isAvailable = result.status === "available";
  const statusColor = isAvailable ? "var(--success)" : "var(--danger)";

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              {result.room_name}
            </h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--border)", color: "var(--text-muted)" }}
            >
              {ROOM_TYPE_LABELS[result.room_type] || result.room_type}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {result.building_name} · Capacity: {result.capacity}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: conf.color + "18",
              color: conf.color,
              border: `1px solid ${conf.color}33`,
            }}
          >
            {conf.label}
          </span>
          <span className="flex items-center gap-1" style={{ fontSize: 12, color: statusColor }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, display: "inline-block" }} />
            {isAvailable ? "Available now" : "Occupied"}
          </span>
        </div>
      </div>

      {/* AI reasoning */}
      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          background: "var(--bg-primary)",
          borderRadius: 6,
          padding: "8px 12px",
          borderLeft: "2px solid var(--accent)",
          lineHeight: 1.6,
        }}
      >
        {result.reasoning}
      </p>

      {/* Equipment tags */}
      {result.equipment?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.equipment.map((eq) => (
            <span
              key={eq}
              className="text-xs px-2 py-0.5 rounded-md"
              style={{ background: "var(--border)", color: "var(--text-muted)" }}
            >
              {EQUIPMENT_ICONS[eq] || "·"} {eq.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {/* Book button */}
      <button
        onClick={() => onBook(result.room_id, result.room_name)}
        disabled={!isAvailable}
        style={{
          background: isAvailable ? "var(--accent)" : "var(--border)",
          color: isAvailable ? "#000" : "var(--text-muted)",
          border: "none",
          borderRadius: 8,
          padding: "8px 18px",
          fontSize: 13,
          fontWeight: 600,
          cursor: isAvailable ? "pointer" : "not-allowed",
          alignSelf: "flex-start",
          transition: "opacity 150ms",
        }}
        onMouseEnter={(e) => { if (isAvailable) e.currentTarget.style.opacity = "0.85"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        {isAvailable ? "Book Now" : "Unavailable"}
      </button>
    </div>
  );
}

// ─── Recommendation Card ──────────────────────────────────────────────────────
function RecommendationCard({ rec, onBook }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 flex-shrink-0"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        width: 260,
        transition: "border-color 150ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(0,200,150,0.3)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          {rec.room_name}
        </h4>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{rec.building_name}</p>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, flex: 1 }}>
        {rec.explanation}
      </p>
      <button
        onClick={() => onBook(rec.room_id, rec.room_name)}
        style={{
          background: "transparent",
          color: "var(--accent)",
          border: "1px solid rgba(0,200,150,0.3)",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "background 150ms",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-muted)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        Book Now
      </button>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard({ height = 140, width }) {
  return (
    <div
      className="rounded-xl animate-pulse flex-shrink-0"
      style={{
        height,
        width: width || "auto",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Spaces() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = not yet searched
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [slowSearch, setSlowSearch] = useState(false);
  const slowTimer = useRef(null);

  // Data state
  const [buildings, setBuildings] = useState([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);
  const [buildingsError, setBuildingsError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);

  useEffect(() => {
    fetchBuildings();
    if (user) fetchRecommendations();
    return () => clearTimeout(slowTimer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBuildings = async () => {
    setBuildingsLoading(true);
    setBuildingsError("");
    try {
      const data = await api.getBuildings();
      setBuildings(data);
    } catch {
      setBuildingsError("Failed to load buildings. Please try again.");
    } finally {
      setBuildingsLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    setRecsLoading(true);
    try {
      const data = await api.getRecommendations();
      setRecommendations(data);
    } catch {
      setRecommendations([]); // Non-critical — fail silently
    } finally {
      setRecsLoading(false);
    }
  };

  const handleSearch = async (overrideQuery) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;

    setQuery(q);
    setSearchError("");
    setSearchLoading(true);
    setSearchResults(null);
    setSlowSearch(false);
    clearTimeout(slowTimer.current);

    // Show "Still thinking…" warning after 5 seconds
    slowTimer.current = setTimeout(() => setSlowSearch(true), 5000);

    try {
      const data = await api.aiSearch(q);
      clearTimeout(slowTimer.current);
      setSearchResults(data.results ?? []);
      if (data.ai_fallback) {
        setSearchError("AI search is temporarily unavailable. Showing keyword results instead.");
      }
    } catch {
      clearTimeout(slowTimer.current);
      setSearchError("AI search is temporarily unavailable. Showing keyword results instead.");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
      setSlowSearch(false);
    }
  };

  const clearSearch = () => {
    clearTimeout(slowTimer.current);
    setQuery("");
    setSearchResults(null);
    setSearchError("");
    setSearchLoading(false);
    setSlowSearch(false);
  };

  const handleBook = (roomId, roomName) => {
    navigate(`/bookings/new?roomId=${roomId}&roomName=${encodeURIComponent(roomName)}`);
  };

  const isSearchMode = searchResults !== null || searchLoading;

  return (
    <div className="p-6 flex flex-col gap-8" style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* ── AI Search Bar ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder='Describe what you need… (e.g. "quiet room for 6 with a projector near the library")'
            style={{
              width: "100%",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "14px 130px 14px 18px",
              fontSize: 15,
              color: "var(--text-primary)",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 150ms, box-shadow 150ms",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent)";
              e.target.style.boxShadow = "0 0 0 3px rgba(0,200,150,0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border)";
              e.target.style.boxShadow = "none";
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              gap: 6,
            }}
          >
            {isSearchMode && (
              <button
                onClick={clearSearch}
                style={{
                  background: "var(--border)",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={() => handleSearch()}
              disabled={searchLoading || !query.trim()}
              style={{
                background: query.trim() ? "var(--accent)" : "var(--border)",
                border: "none",
                borderRadius: 6,
                padding: "5px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: query.trim() ? "#000" : "var(--text-muted)",
                cursor: query.trim() && !searchLoading ? "pointer" : "not-allowed",
                transition: "opacity 150ms",
              }}
            >
              {searchLoading ? "…" : "Search"}
            </button>
          </div>
        </div>

        {/* Suggestion pills */}
        {!isSearchMode && (
          <div className="flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 20,
                  padding: "5px 13px",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  transition: "border-color 150ms, color 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Search Results ─────────────────────────────────────────────────── */}
      {isSearchMode && (
        <section className="flex flex-col gap-4">
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            {searchLoading
              ? (slowSearch ? "Still thinking…" : "Searching…")
              : `${searchResults?.length ?? 0} result${searchResults?.length !== 1 ? "s" : ""} for "${query}"`}
          </h2>

          {searchError && (
            <p
              style={{
                fontSize: 13,
                color: "var(--warning)",
                background: "rgba(245,166,35,0.08)",
                border: "1px solid rgba(245,166,35,0.25)",
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              {searchError}
            </p>
          )}

          {searchLoading ? (
            <div className="flex flex-col gap-3">
              <SkeletonCard height={160} />
              <SkeletonCard height={160} />
              <SkeletonCard height={160} />
            </div>
          ) : searchResults?.length === 0 ? (
            <div
              className="rounded-xl p-10 text-center"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <p style={{ fontSize: 32, marginBottom: 12 }}>◻</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                No rooms match that description
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                Try adjusting your search or browse all spaces below.
              </p>
              <button
                onClick={clearSearch}
                style={{
                  background: "var(--accent)",
                  color: "#000",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Browse All Spaces
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {searchResults.map((result) => (
                <SearchResultCard key={result.room_id} result={result} onBook={handleBook} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Suggested for You ──────────────────────────────────────────────── */}
      {!isSearchMode && (
        <section className="flex flex-col gap-3">
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            Suggested for You
          </h2>
          {recsLoading ? (
            <div className="flex gap-4" style={{ overflow: "hidden" }}>
              {[1, 2, 3].map((i) => <SkeletonCard key={i} height={140} width={260} />)}
            </div>
          ) : recommendations.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Getting to know your preferences…
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.room_id} rec={rec} onBook={handleBook} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Campus Buildings ───────────────────────────────────────────────── */}
      {!isSearchMode && (
        <section className="flex flex-col gap-4">
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            Campus Buildings
            {!buildingsLoading && buildings.length > 0 && (
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
                {buildings.length} buildings
              </span>
            )}
          </h2>

          {buildingsError ? (
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{buildingsError}</p>
              <button
                onClick={fetchBuildings}
                style={{
                  background: "var(--accent)",
                  color: "#000",
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          ) : buildingsLoading ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} height={160} />)}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {buildings.map((b) => (
                <BuildingGridCard
                  key={b.id}
                  building={b}
                  onClick={() => navigate(`/spaces/${b.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
