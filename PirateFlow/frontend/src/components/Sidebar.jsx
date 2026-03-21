import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../App";

const adminNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: "⬡" },
  { path: "/spaces", label: "Spaces", icon: "◫" },
  { path: "/bookings", label: "Bookings", icon: "◷" },
  { path: "/analytics", label: "Analytics", icon: "◈" },
  { path: "/revenue", label: "Revenue", icon: "◎" },
  { path: "/alerts", label: "Alerts", icon: "◬" },
];

const studentNavItems = [
  { path: "/spaces", label: "Spaces", icon: "◫" },
  { path: "/bookings", label: "Bookings", icon: "◷" },
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
        width: collapsed ? "64px" : "220px",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: "22px" }}>🏴‍☠️</span>
        {!collapsed && (
          <span style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--accent)", letterSpacing: "-0.5px", fontWeight: 700 }}>
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
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 relative"
            style={({ isActive }) => ({
              background: isActive ? "var(--accent-muted)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              fontWeight: isActive ? 600 : 400,
              fontSize: "14px",
              textDecoration: "none",
            })}
          >
            <span style={{ fontSize: "16px", minWidth: "20px", textAlign: "center" }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
            {item.path === "/alerts" && alertCount > 0 && isAdmin && (
              <span
                className="ml-auto text-xs rounded-full px-1.5 py-0.5"
                style={{ background: "var(--danger)", color: "#fff", fontSize: "11px", minWidth: "20px", textAlign: "center" }}
              >
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout + collapse */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "12px" }}>
        {!collapsed && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div
              className="rounded-full flex items-center justify-center text-sm font-bold"
              style={{ width: 32, height: 32, background: "var(--accent)", color: "#000", flexShrink: 0 }}
            >
              {user?.name?.[0] || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name || "Guest"}
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>SHU {isAdmin ? "Staff" : "Student"}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg transition-all mb-1"
          style={{ color: "var(--danger)", fontSize: "12px", background: "transparent", border: "1px solid transparent", cursor: "pointer" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--danger)"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
        >
          <span>⎋</span>
          {!collapsed && <span>Logout</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-1 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)", fontSize: "12px", background: "transparent", border: "none", cursor: "pointer" }}
        >
          {collapsed ? "→" : "← Collapse"}
        </button>
      </div>
    </aside>
  );
}