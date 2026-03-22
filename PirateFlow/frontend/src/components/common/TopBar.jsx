import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignOut = () => {
    logout();
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        {/* Brand */}
        <div
          className="topbar-brand"
          onClick={() => navigate("/")}
        >
          <img
            src="/PirateFlow.png"
            alt="PirateFlow"
            style={{
              width: 36,
              height: 36,
              objectFit: "contain",
            }}
          />
          <div>
            <div className="topbar-brand-name">
              PirateFlow
            </div>
            <div className="topbar-brand-sub">
              Seton Hall University
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="topbar-nav">
          {[
            { path: "/", label: "Browse Rooms", show: true },
            { path: "/events", label: "Events", show: true },
            { path: "/bookings", label: "My Bookings", show: !!user },
            { path: "/face/verify", label: "Face Access", show: !!user },
            { path: "/dashboard", label: "Dashboard", show: user?.role === "admin" },
          ]
            .filter((l) => l.show)
            .map(({ path, label }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`topbar-nav-btn ${isActive(path) ? "active" : ""}`}
              >
                {label}
              </button>
            ))}
        </nav>

        {/* User */}
        <div className="topbar-user">
          {user ? (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="topbar-user-btn"
              >
                <div className="topbar-user-info hide-mobile">
                  <div className="topbar-user-name">
                    {user.name}
                  </div>
                  <div className="topbar-user-role">
                    {user.role === "admin" ? "Administrator" : "Student"}
                  </div>
                </div>
                <div className="topbar-avatar">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="topbar-menu-overlay"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="topbar-menu">
                    <div className="topbar-menu-info">
                      <p className="topbar-menu-name">{user.name}</p>
                      <p className="topbar-menu-email">{user.email}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="topbar-menu-btn"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="topbar-signin"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
