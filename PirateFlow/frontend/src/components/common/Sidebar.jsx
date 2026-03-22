import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const adminNavItems = [
  { path: "/dashboard",      label: "Dashboard",      icon: "dashboard" },
  { path: "/",               label: "Spaces",          icon: "spaces" },
  { path: "/bookings",       label: "Bookings",        icon: "bookings" },
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
    <aside
      className="flex flex-col h-screen sticky top-0 transition-all duration-300"
      style={{
        width: collapsed ? 72 : 240,
        background: "linear-gradient(195deg, #001a3a 0%, #002d62 40%, #003d7a 100%)",
        flexShrink: 0,
        boxShadow: "4px 0 24px rgba(0,20,60,.15)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5"
        style={{
          borderBottom: "1px solid rgba(255,255,255,.08)",
          height: 64,
          flexShrink: 0,
        }}
      >
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
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              color: "#ffffff",
              letterSpacing: "-0.5px",
              fontWeight: 700,
            }}
          >
            PirateFlow
          </span>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <span
            className="text-xs px-3 py-1 rounded-full font-semibold inline-flex items-center gap-1.5"
            style={{
              background: isAdmin
                ? "linear-gradient(135deg, rgba(255,255,255,.15), rgba(255,255,255,.05))"
                : "rgba(255,255,255,.08)",
              color: isAdmin ? "#7eb8ff" : "rgba(255,255,255,.5)",
              border: `1px solid ${isAdmin ? "rgba(126,184,255,.2)" : "rgba(255,255,255,.08)"}`,
              backdropFilter: "blur(8px)",
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isAdmin ? "#7eb8ff" : "rgba(255,255,255,.4)",
            }} />
            {isAdmin ? "Admin" : "Student"}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group"
            style={({ isActive }) => ({
              background: isActive
                ? "linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.06))"
                : "transparent",
              color: isActive ? "#ffffff" : "rgba(255,255,255,.55)",
              fontWeight: isActive ? 600 : 400,
              fontSize: 13.5,
              textDecoration: "none",
              borderLeft: isActive ? "3px solid #5ca8ff" : "3px solid transparent",
              paddingLeft: isActive ? 12 : 12,
            })}
          >
            <span style={{ minWidth: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <NavIcon name={item.icon} size={18} />
            </span>
            {!collapsed && <span>{item.label}</span>}
            {item.path === "/alerts" && alertCount > 0 && isAdmin && (
              <span
                className="ml-auto text-xs rounded-full px-2 py-0.5 font-bold"
                style={{
                  background: "linear-gradient(135deg, #e74c3c, #c0392b)",
                  color: "#fff",
                  fontSize: 10,
                  minWidth: 20,
                  textAlign: "center",
                  boxShadow: "0 2px 8px rgba(231,76,60,.4)",
                }}
              >
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + controls */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", padding: 12 }}>
        {!collapsed && (
          <div
            className="flex items-center gap-3 mb-3 px-2 py-2.5 rounded-xl"
            style={{ background: "rgba(255,255,255,.06)" }}
          >
            <div
              className="rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                width: 34,
                height: 34,
                background: "linear-gradient(135deg, #5ca8ff, #004B8D)",
                color: "#fff",
                flexShrink: 0,
                fontSize: 14,
                boxShadow: "0 2px 8px rgba(92,168,255,.3)",
              }}
            >
              {user?.name?.[0] || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{
                fontSize: 13, fontWeight: 600, color: "#fff",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {user?.name || "Guest"}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>
                SHU {isAdmin ? "Staff" : "Student"}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl transition-all"
          style={{
            color: "rgba(255,255,255,.5)",
            fontSize: 12,
            background: "transparent",
            border: "1px solid rgba(255,255,255,.08)",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(231,76,60,.15)";
            e.currentTarget.style.borderColor = "rgba(231,76,60,.3)";
            e.currentTarget.style.color = "#ff7b7b";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(255,255,255,.08)";
            e.currentTarget.style.color = "rgba(255,255,255,.5)";
          }}
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
          className="w-full flex items-center justify-center py-1.5 rounded-xl transition-colors mt-1.5"
          style={{
            color: "rgba(255,255,255,.35)",
            fontSize: 11,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,.6)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,.35)"}
        >
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          ) : (
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Collapse
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
