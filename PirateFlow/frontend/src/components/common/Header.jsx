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
      className="flex items-center justify-between px-6 sticky top-0 z-10"
      style={{
        background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        height: 56,
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.5px",
        }}
      >
        {title}
      </h1>

      <div className="flex items-center gap-3">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-full"
            style={{
              width: 7,
              height: 7,
              background: connected ? "var(--success)" : "var(--text-muted)",
              display: "inline-block",
              boxShadow: connected ? "0 0 6px var(--success)" : "none",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Alert bell */}
        {isAdmin && (
          <button
            onClick={() => navigate("/alerts")}
            className="relative"
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, padding: "4px 6px" }}
          >
            <span role="img" aria-label="alerts">&#x1F514;</span>
            {alertCount > 0 && (
              <span
                className="absolute -top-1 -right-1 text-xs rounded-full flex items-center justify-center"
                style={{ background: "var(--danger)", color: "#fff", width: 15, height: 15, fontSize: 9 }}
              >
                {alertCount}
              </span>
            )}
          </button>
        )}

        {/* User avatar + dropdown */}
        <div className="relative group">
          <div
            className="rounded-full flex items-center justify-center font-bold cursor-pointer"
            style={{ width: 32, height: 32, background: "var(--accent)", color: "#fff", fontSize: 13 }}
          >
            {user?.name?.[0] || "?"}
          </div>
          <div
            className="absolute right-0 top-full mt-1.5 rounded-lg py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", minWidth: 140, zIndex: 50 }}
          >
            <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{user?.name}</p>
              <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{isAdmin ? "Admin" : "Student"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 transition-colors"
              style={{ background: "transparent", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--accent-muted)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
