import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { ROOM_TYPE_LABELS, EQUIPMENT_ICONS } from "../../constants/rooms";

function getOccupancyInfo(pct) {
  if (pct < 0.4) return { label: "Low", color: "var(--success)" };
  if (pct < 0.7) return { label: "Moderate", color: "var(--warning)" };
  return { label: "High", color: "var(--danger)" };
}

function BuildingCard({ building, onClick }) {
  const occ = getOccupancyInfo(building.current_occupancy_pct);
  const available = Math.round(building.room_count * (1 - building.current_occupancy_pct));

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 cursor-pointer flex flex-col gap-2.5"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        transition: "border-color 150ms, transform 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,200,150,0.3)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{building.name}</h3>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{building.total_floors} floors</p>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
          style={{ background: occ.color + "18", color: occ.color, border: `1px solid ${occ.color}33` }}
        >
          {occ.label}
        </span>
      </div>

      <div className="flex gap-5">
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", lineHeight: 1 }}>{available}</p>
          <p style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>available</p>
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)", lineHeight: 1 }}>{building.room_count}</p>
          <p style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>total</p>
        </div>
      </div>

      <div>
        <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round(building.current_occupancy_pct * 100)}%`, background: occ.color, borderRadius: 2 }} />
        </div>
        <p style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
          {Math.round(building.current_occupancy_pct * 100)}% occupied
        </p>
      </div>

      <p style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500 }}>View rooms &rarr;</p>
    </div>
  );
}

function SearchResult({ result, onBook }) {
  const isAvailable = result.status === "available";

  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{result.room_name}</h3>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
            {result.building_name} &middot; {ROOM_TYPE_LABELS[result.room_type] || result.room_type} &middot; {result.capacity} people
          </p>
        </div>
        <span className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 10, color: isAvailable ? "var(--success)" : "var(--danger)" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: isAvailable ? "var(--success)" : "var(--danger)", display: "inline-block" }} />
          {isAvailable ? "Available" : "Occupied"}
        </span>
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-primary)", borderRadius: 6, padding: "5px 8px", borderLeft: "2px solid var(--accent)", lineHeight: 1.5 }}>
        {result.reasoning}
      </p>

      {result.equipment?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.equipment.map((eq) => (
            <span key={eq} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-muted)", fontSize: 10 }}>
              {EQUIPMENT_ICONS[eq] || "\u00B7"} {eq.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => onBook(result.room_id, result.room_name)}
        disabled={!isAvailable}
        style={{
          background: isAvailable ? "var(--accent)" : "var(--border)",
          color: isAvailable ? "#000" : "var(--text-muted)",
          border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600,
          cursor: isAvailable ? "pointer" : "not-allowed", alignSelf: "flex-start", transition: "opacity 150ms",
        }}
      >
        {isAvailable ? "Book Now" : "Unavailable"}
      </button>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const slowTimer = useRef(null);
  const [slowSearch, setSlowSearch] = useState(false);

  const [buildings, setBuildings] = useState([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);

  useEffect(() => {
    api.getBuildings()
      .then(setBuildings)
      .catch(() => {})
      .finally(() => setBuildingsLoading(false));
    return () => clearTimeout(slowTimer.current);
  }, []);

  const handleSearch = async (q) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setQuery(text);
    setSearchError("");
    setSearchLoading(true);
    setSearchResults(null);
    setSlowSearch(false);
    clearTimeout(slowTimer.current);
    slowTimer.current = setTimeout(() => setSlowSearch(true), 5000);

    try {
      const data = await api.aiSearch(text);
      clearTimeout(slowTimer.current);
      setSearchResults(data.results ?? []);
      if (data.ai_fallback) setSearchError("AI search unavailable. Showing basic results.");
    } catch {
      clearTimeout(slowTimer.current);
      setSearchResults([]);
      setSearchError("Search failed. Try browsing buildings below.");
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
  };

  const handleBook = (roomId, roomName) => {
    navigate(`/bookings/new?roomId=${roomId}&roomName=${encodeURIComponent(roomName)}`);
  };

  const isSearchMode = searchResults !== null || searchLoading;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Header */}
      <header style={{
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
        height: 52,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>&#x1F3F4;&#x200D;&#x2620;&#xFE0F;</span>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.5px", lineHeight: 1 }}>
              PirateFlow
            </h1>
            <p style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 1, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Campus Space Intelligence
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {user ? (
            <>
              <button onClick={() => navigate("/bookings")}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer", transition: "all 150ms" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}>
                My Bookings
              </button>
              {user.role === "admin" && (
                <button onClick={() => navigate("/dashboard")}
                  style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Dashboard
                </button>
              )}
            </>
          ) : (
            <button onClick={() => navigate("/login")}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 14px", fontSize: 11, color: "var(--text-muted)", cursor: "pointer", transition: "all 150ms" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}>
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Hero + Search */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px 28px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: 6 }}>
          Find your space
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Search by description or browse Seton Hall buildings below
        </p>

        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder='e.g. "quiet room for 6 with a projector near the library"'
            style={{
              width: "100%",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "12px 110px 12px 16px",
              fontSize: 13,
              color: "var(--text-primary)",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 150ms, box-shadow 150ms",
            }}
            onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,200,150,0.08)"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
          />
          <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 3 }}>
            {isSearchMode && (
              <button onClick={clearSearch} style={{ background: "var(--border)", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 10, color: "var(--text-muted)", cursor: "pointer" }}>
                Clear
              </button>
            )}
            <button
              onClick={() => handleSearch()}
              disabled={searchLoading || !query.trim()}
              style={{
                background: query.trim() ? "var(--accent)" : "var(--border)",
                border: "none", borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: 600,
                color: query.trim() ? "#000" : "var(--text-muted)",
                cursor: query.trim() && !searchLoading ? "pointer" : "not-allowed",
              }}
            >
              {searchLoading ? "\u2026" : "Search"}
            </button>
          </div>
        </div>

        {!isSearchMode && (
          <div className="flex flex-wrap justify-center gap-1.5" style={{ marginTop: 10 }}>
            {["Study rooms available now", "Computer labs", "Large lecture halls", "Rooms with projector"].map((s) => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16,
                  padding: "3px 10px", fontSize: 10, color: "var(--text-muted)", cursor: "pointer", transition: "all 150ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search Results */}
      {isSearchMode && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 28px" }} className="flex flex-col gap-2.5">
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {searchLoading ? (slowSearch ? "Still thinking\u2026" : "Searching\u2026") : `${searchResults?.length ?? 0} results`}
          </p>
          {searchError && <p style={{ fontSize: 11, color: "var(--warning)" }}>{searchError}</p>}

          {searchLoading ? (
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map((i) => <div key={i} className="rounded-xl animate-pulse" style={{ height: 100, background: "var(--bg-card)", border: "1px solid var(--border)" }} />)}
            </div>
          ) : searchResults?.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>No rooms match</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Try different terms or browse buildings below.</p>
              <button onClick={clearSearch} style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Browse Buildings
              </button>
            </div>
          ) : (
            searchResults.map((r) => <SearchResult key={r.room_id} result={r} onBook={handleBook} />)
          )}
        </div>
      )}

      {/* Building Grid */}
      {!isSearchMode && (
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 20px 40px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
            Campus Buildings
          </h3>

          {buildingsLoading ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="rounded-xl animate-pulse" style={{ height: 140, background: "var(--bg-card)", border: "1px solid var(--border)" }} />)}
            </div>
          ) : buildings.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No buildings available. The server may be starting up.</p>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {buildings.map((b) => (
                <BuildingCard key={b.id} building={b} onClick={() => navigate(`/spaces/${b.id}`)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
