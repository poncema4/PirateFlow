import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const adminNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: "\u2B21" },
  { path: "/",          label: "Spaces",    icon: "\u25EB" },
  { path: "/bookings",  label: "Bookings",  icon: "\u25F7" },
  { path: "/analytics", label: "Analytics", icon: "\u25C8" },
  { path: "/revenue",   label: "Revenue",   icon: "\u25CE" },
  { path: "/alerts",    label: "Alerts",    icon: "\u25EC" },
];

const studentNavItems = [
  { path: "/",          label: "Spaces",   icon: "\u25EB" },
  { path: "/bookings",  label: "Bookings", icon: "\u25F7" },
];

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
        width: collapsed ? 60 : 200,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4"
        style={{ borderBottom: "1px solid var(--border)", height: 56, flexShrink: 0 }}
      >
        <span style={{ fontSize: 20 }}>&#x1F3F4;&#x200D;&#x2620;&#xFE0F;</span>
        {!collapsed && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              color: "var(--accent)",
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
        <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: isAdmin ? "var(--accent-muted)" : "var(--border)",
              color: isAdmin ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${isAdmin ? "var(--accent)44" : "transparent"}`,
            }}
          >
            {isAdmin ? "Admin" : "Student"}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 relative"
            style={({ isActive }) => ({
              background: isActive ? "var(--accent-muted)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              textDecoration: "none",
            })}
          >
            <span style={{ fontSize: 14, minWidth: 18, textAlign: "center" }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
            {item.path === "/alerts" && alertCount > 0 && isAdmin && (
              <span
                className="ml-auto text-xs rounded-full px-1.5 py-0.5"
                style={{ background: "var(--danger)", color: "#fff", fontSize: 10, minWidth: 18, textAlign: "center" }}
              >
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + controls */}
      <div style={{ borderTop: "1px solid var(--border)", padding: 10 }}>
        {!collapsed && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div
              className="rounded-full flex items-center justify-center text-sm font-bold"
              style={{ width: 28, height: 28, background: "var(--accent)", color: "#000", flexShrink: 0 }}
            >
              {user?.name?.[0] || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name || "Guest"}
              </p>
              <p style={{ fontSize: 10, color: "var(--text-muted)" }}>SHU {isAdmin ? "Staff" : "Student"}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg transition-all mb-1"
          style={{ color: "var(--danger)", fontSize: 11, background: "transparent", border: "1px solid transparent", cursor: "pointer" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--danger)"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
        >
          <span>&#x238B;</span>
          {!collapsed && <span>Logout</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-1 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)", fontSize: 11, background: "transparent", border: "none", cursor: "pointer" }}
        >
          {collapsed ? "\u2192" : "\u2190 Collapse"}
        </button>
      </div>
    </aside>
  );
}
