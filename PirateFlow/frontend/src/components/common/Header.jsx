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
    <header className="header">
      <h1 className="header-title">
        {title}
      </h1>

      <div className="header-actions">
        {/* Live indicator */}
        <div className={`header-live-badge ${connected ? "online" : "offline"}`}>
          <span className={`header-live-dot ${connected ? "online" : "offline"}`} />
          <span className={`header-live-text ${connected ? "online" : "offline"}`}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Alert bell */}
        {isAdmin && (
          <button
            onClick={() => navigate("/alerts")}
            className="header-alert-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {alertCount > 0 && (
              <span className="header-alert-count">
                {alertCount}
              </span>
            )}
          </button>
        )}

        {/* User avatar + dropdown */}
        <div className="header-avatar-wrap">
          <div className="header-avatar">
            {user?.name?.[0] || "?"}
          </div>
          <div className="header-dropdown">
            <div className="header-dropdown-info">
              <p className="header-dropdown-name">{user?.name}</p>
              <p className="header-dropdown-role">{isAdmin ? "Administrator" : "Student"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="header-dropdown-btn"
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
