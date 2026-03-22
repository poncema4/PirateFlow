import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleSignOut = () => {
    logout();
    navigate("/");
  };

  const linkStyle = (path) => ({
    fontSize: 12,
    fontWeight: 500,
    color: location.pathname === path ? "#fff" : "rgba(255,255,255,.55)",
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
    letterSpacing: ".03em",
    textDecoration: "none",
    transition: "color .22s ease",
    background: "none",
    border: "none",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  });

  return (
    <header style={{
      background: "#00345E",
      padding: "0 28px",
      height: 52,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 100,
      borderBottom: "1px solid rgba(255,255,255,.1)",
    }}>
      {/* Brand */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
        onClick={() => navigate("/")}
      >
        <img
          src="/PirateFlow.png"
          alt="PirateFlow"
          style={{ width: 30, height: 30, objectFit: "contain" }}
        />
        <div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 15, color: "#fff", letterSpacing: ".02em",
          }}>
            PirateFlow
          </div>
          <div style={{
            fontSize: 9, color: "rgba(255,255,255,.5)",
            letterSpacing: ".06em", textTransform: "uppercase",
          }}>
            Seton Hall University
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", gap: 2 }}>
        <button onClick={() => navigate("/")} style={linkStyle("/")}>
          Browse Rooms
        </button>
        {user && (
          <button onClick={() => navigate("/bookings")} style={linkStyle("/bookings")}>
            My Bookings
          </button>
        )}
        {user?.role === "admin" && (
          <button onClick={() => navigate("/dashboard")} style={linkStyle("/dashboard")}>
            Dashboard
          </button>
        )}
      </nav>

      {/* User */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {user ? (
          <>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.45)" }}>
                {user.role === "admin" ? "Admin" : "Student"}
              </div>
            </div>
            <div
              style={{
                width: 30, height: 30,
                background: "#fff",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#00345E",
                cursor: "pointer",
              }}
              onClick={handleSignOut}
              title="Sign Out"
            >
              {user.name?.[0] || "?"}
            </div>
          </>
        ) : (
          <button
            onClick={() => navigate("/login")}
            style={{
              fontSize: 12, fontWeight: 600, color: "#fff",
              padding: "6px 16px", borderRadius: 6, cursor: "pointer",
              border: "1px solid rgba(255,255,255,.3)",
              background: "transparent",
              transition: "all .22s ease",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
