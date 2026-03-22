import { useLocation, useNavigate } from "react-router-dom";
import { useWebSocket } from "../../context/WebSocketContext";
import { useAuth } from "../../hooks/useAuth";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/analytics": "Utilization Analytics",
  "/revenue": "Revenue Dashboard",
  "/alerts": "Anomaly Alerts",
  "/bookings": "My Bookings",
  "/bookings/new": "New Booking",
};

export default function Header({ alertCount = 0 }) {
  const location = useLocation();
  const { connected } = useWebSocket();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const buildingMatch = location.pathname.match(/^\/spaces\/(.+)/);
  const title = pageTitles[location.pathname] || (buildingMatch ? "Building Detail" : "PirateFlow");
  const isAdmin = user?.role === "admin";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      className="flex items-center justify-between px-8 sticky top-0 z-10"
      style={{
        background: "rgba(245,241,235,.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        height: 64,
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.5px",
        }}
      >
        {title}
      </h1>

      <div className="flex items-center gap-4">
        {/* Live indicator */}
        <div
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full"
          style={{
            background: connected ? "rgba(34,135,90,.08)" : "rgba(192,57,43,.06)",
            border: `1px solid ${connected ? "rgba(34,135,90,.15)" : "rgba(192,57,43,.12)"}`,
          }}
        >
          <span
            className="rounded-full"
            style={{
              width: 8,
              height: 8,
              background: connected ? "var(--success)" : "var(--danger)",
              display: "inline-block",
              animation: connected ? "livePulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span style={{
            fontSize: 12,
            color: connected ? "var(--success)" : "var(--danger)",
            fontWeight: 600,
          }}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Alert bell */}
        {isAdmin && (
          <button
            onClick={() => navigate("/alerts")}
            className="relative transition-transform duration-200"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              padding: "6px 8px",
              borderRadius: 10,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(0,75,141,.06)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {alertCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 text-xs rounded-full flex items-center justify-center font-bold"
                style={{
                  background: "linear-gradient(135deg, #e74c3c, #c0392b)",
                  color: "#fff",
                  width: 18,
                  height: 18,
                  fontSize: 10,
                  boxShadow: "0 2px 6px rgba(231,76,60,.4)",
                }}
              >
                {alertCount}
              </span>
            )}
          </button>
        )}

        {/* User avatar + dropdown */}
        <div className="relative group">
          <div
            className="rounded-full flex items-center justify-center font-bold cursor-pointer transition-all duration-200"
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #004B8D, #2B6FAF)",
              color: "#fff",
              fontSize: 14,
              boxShadow: "0 2px 8px rgba(0,75,141,.25)",
            }}
          >
            {user?.name?.[0] || "?"}
          </div>
          <div
            className="absolute right-0 top-full mt-2 rounded-xl py-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              minWidth: 160,
              zIndex: 50,
              boxShadow: "var(--shadow-lg)",
              transform: "translateY(4px)",
            }}
          >
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{user?.name}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{isAdmin ? "Administrator" : "Student"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 transition-colors flex items-center gap-2"
              style={{ background: "transparent", border: "none", color: "var(--danger)", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(192,57,43,.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
