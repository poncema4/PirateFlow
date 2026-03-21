import { useLocation, useNavigate } from "react-router-dom";
import { useWebSocket } from "../context/WebSocketContext";
import { useAuth } from "../App";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/analytics": "Utilization Analytics",
  "/revenue": "Revenue Dashboard",
  "/alerts": "Anomaly Alerts",
  "/spaces": "Campus Spaces",
  "/bookings": "Bookings",
};

export default function Header({ alertCount = 0 }) {
  const location = useLocation();
  const { connected } = useWebSocket();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const title = pageTitles[location.pathname] || "PirateFlow";
  const isAdmin = user?.role === "admin";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
      style={{
        background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        height: "64px",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.5px",
        }}
      >
        {title}
      </h1>

      <div className="flex items-center gap-4">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span
            className="rounded-full"
            style={{
              width: 8,
              height: 8,
              background: connected ? "var(--success)" : "var(--text-muted)",
              display: "inline-block",
              boxShadow: connected ? "0 0 6px var(--success)" : "none",
            }}
          />
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Alert bell — admin only */}
        {isAdmin && (
          <button
            onClick={() => navigate("/alerts")}
            className="relative"
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "18px" }}
          >
            🔔
            {alertCount > 0 && (
              <span
                className="absolute -top-1 -right-1 text-xs rounded-full flex items-center justify-center"
                style={{ background: "var(--danger)", color: "#fff", width: 16, height: 16, fontSize: "10px" }}
              >
                {alertCount}
              </span>
            )}
          </button>
        )}

        {/* Avatar + logout dropdown */}
        <div className="relative group">
          <div
            className="rounded-full flex items-center justify-center font-bold cursor-pointer"
            style={{ width: 36, height: 36, background: "var(--accent)", color: "#000", fontSize: "14px" }}
          >
            {user?.name?.[0] || "?"}
          </div>
          {/* Dropdown on hover */}
          <div
            className="absolute right-0 top-full mt-2 rounded-lg py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", minWidth: 140, zIndex: 50 }}
          >
            <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{user?.name}</p>
              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{isAdmin ? "Admin" : "Student"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 transition-colors"
              style={{ background: "transparent", border: "none", color: "var(--danger)", fontSize: "13px", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--accent-muted)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              ⎋ Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}