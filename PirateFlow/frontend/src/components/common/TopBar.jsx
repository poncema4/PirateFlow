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
    <header className="sticky top-0 z-50 bg-shu-blue-dk border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate("/")}
        >
          <img
            src="/PirateFlow.png"
            alt="PirateFlow"
            className="w-9 h-9 object-contain group-hover:scale-105 transition-transform duration-200"
          />
          <div>
            <div className="font-display text-[17px] text-white tracking-wide">
              PirateFlow
            </div>
            <div className="text-[10px] text-white/45 tracking-widest uppercase">
              Seton Hall University
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {[
            { path: "/", label: "Browse Rooms", show: true },
            { path: "/bookings", label: "My Bookings", show: !!user },
            { path: "/dashboard", label: "Dashboard", show: user?.role === "admin" },
          ]
            .filter((l) => l.show)
            .map(({ path, label }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`
                  px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer
                  transition-all duration-200 border-none font-body
                  ${isActive(path)
                    ? "bg-white/15 text-white"
                    : "bg-transparent text-white/55 hover:text-white hover:bg-white/8"
                  }
                `}
              >
                {label}
              </button>
            ))}
        </nav>

        {/* User */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-3 cursor-pointer bg-transparent border-none"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-[13px] font-semibold text-white leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[11px] text-white/45">
                    {user.role === "admin" ? "Administrator" : "Student"}
                  </div>
                </div>
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-[13px] font-bold text-shu-blue-dk hover:scale-105 transition-transform duration-200">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-border z-50 overflow-hidden animate-[slideDown_.15s_ease]">
                    <div className="px-4 py-3 border-b border-cream-dk">
                      <p className="text-sm font-semibold text-navy">{user.name}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-cream transition-colors cursor-pointer border-none bg-transparent font-body"
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
              className="
                text-[13px] font-semibold text-white px-5 py-2 rounded-lg cursor-pointer
                border border-white/25 bg-white/10 font-body
                transition-all duration-200
                hover:bg-white/20 hover:border-white/40
              "
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
