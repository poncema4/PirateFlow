import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const adminNavItems = [
  { path: "/dashboard",      label: "Dashboard",      icon: "dashboard" },
  { path: "/spaces",         label: "Spaces",          icon: "spaces" },
  { path: "/bookings",       label: "Bookings",        icon: "bookings" },
  { path: "/events",         label: "Events",          icon: "bookings" },
  { path: "/analytics",      label: "Analytics",       icon: "analytics" },
  { path: "/revenue",        label: "Revenue",         icon: "revenue" },
  { path: "/alerts",         label: "Alerts",          icon: "alerts" },
  { path: "/admin/spaces",   label: "Manage Spaces",   icon: "manage" },
  { path: "/admin/users",    label: "Manage Users",    icon: "users" },
  { path: "/admin/cameras",  label: "Cameras",         icon: "cameras" },
];

const studentNavItems = [
  { path: "/",          label: "Spaces",   icon: "spaces" },
  { path: "/bookings",  label: "Bookings", icon: "bookings" },
];

function NavIcon({ name, size = 18 }) {
  const icons = {
    dashboard: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5"/>
        <rect x="14" y="3" width="7" height="5" rx="1.5"/>
        <rect x="14" y="12" width="7" height="9" rx="1.5"/>
        <rect x="3" y="16" width="7" height="5" rx="1.5"/>
      </svg>
    ),
    spaces: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    bookings: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
      </svg>
    ),
    analytics: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 21H4a1 1 0 01-1-1V3"/>
        <path d="M7 14l4-4 4 4 5-5"/>
      </svg>
    ),
    revenue: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
    alerts: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    manage: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
    users: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    cameras: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    ),
  };
  return icons[name] || null;
}

export default function Sidebar({ alertCount = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? adminNavItems : studentNavItems;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <img
          src="/PirateFlow.png"
          alt="PirateFlow"
          style={{
            width: 32,
            height: 32,
            objectFit: "contain",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,.3))",
          }}
        />
        {!collapsed && (
          <span className="sidebar-logo-text">
            PirateFlow
          </span>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="sidebar-role">
          <span className={`sidebar-role-badge${!isAdmin ? " student" : ""}`}>
            <span className="sidebar-role-dot" />
            {isAdmin ? "Admin" : "Student"}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? " active" : ""}`
            }
          >
            <span className="sidebar-nav-icon">
              <NavIcon name={item.icon} size={18} />
            </span>
            {!collapsed && <span>{item.label}</span>}
            {item.path === "/alerts" && alertCount > 0 && isAdmin && (
              <span className="sidebar-alert-badge">
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + controls */}
      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.name?.[0] || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="sidebar-user-name">
                {user?.name || "Guest"}
              </p>
              <p className="sidebar-user-role">
                SHU {isAdmin ? "Staff" : "Student"}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="sidebar-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {!collapsed && <span>Logout</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-btn-collapse"
        >
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Collapse
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
