import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, createContext, useContext } from "react";
import { WebSocketProvider } from "./context/WebSocketContext";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Revenue from "./pages/Revenue";
import Alerts from "./pages/Alerts";

// ─── Auth Context ─────────────────────────────────────────────────────────────
// Exported so Role 4 can import useAuth() in their login page and call login()
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("pf_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = (userData) => {
    sessionStorage.setItem("pf_user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem("pf_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Route Guards ─────────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== "admin") return <Navigate to="/spaces" replace />;
  return children;
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// ─── Temp Login Page ──────────────────────────────────────────────────────────
// Role 4 will replace this with the real login page.
// They just need to import useAuth() and call login({ name, role }) on submit.
function TempLogin() {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  // Already logged in — redirect away
  if (user) {
    return <Navigate to={user.role === "admin" ? "/dashboard" : "/spaces"} replace />;
  }

  const handleLogin = (role) => {
    login({ name: role === "admin" ? "Admin User" : "Student User", role });
    window.location.href = role === "admin" ? from : "/spaces";
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
      <div
        className="rounded-xl p-8 flex flex-col gap-4 items-center"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", width: 320 }}
      >
        <span style={{ fontSize: 36 }}>🏴‍☠️</span>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--accent)", fontWeight: 700 }}>
          PirateFlow
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
          Campus Space Intelligence — Seton Hall University
        </p>
        <div className="w-full flex flex-col gap-2 mt-2">
          <button
            onClick={() => handleLogin("admin")}
            className="w-full py-2.5 rounded-lg font-semibold transition-all"
            style={{ background: "var(--accent)", color: "#000", border: "none", cursor: "pointer", fontSize: 14 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            Login as Admin
          </button>
          <button
            onClick={() => handleLogin("student")}
            className="w-full py-2.5 rounded-lg font-semibold transition-all"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 14 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
          >
            Login as Student
          </button>
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>
          Temp login — Role 4 will replace this
        </p>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function Layout({ children, alertCount }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)", overflow: "hidden" }}>
      <Sidebar alertCount={alertCount} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, width: 0 }}>
        <Header alertCount={alertCount} />
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [alertCount] = useState(3);

  return (
    <AuthProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<TempLogin />} />

            {/* Admin-only */}
            <Route path="/dashboard" element={
              <AdminRoute>
                <Layout alertCount={alertCount}><Dashboard /></Layout>
              </AdminRoute>
            } />
            <Route path="/analytics" element={
              <AdminRoute>
                <Layout alertCount={alertCount}><Analytics /></Layout>
              </AdminRoute>
            } />
            <Route path="/revenue" element={
              <AdminRoute>
                <Layout alertCount={alertCount}><Revenue /></Layout>
              </AdminRoute>
            } />
            <Route path="/alerts" element={
              <AdminRoute>
                <Layout alertCount={alertCount}><Alerts /></Layout>
              </AdminRoute>
            } />

            {/* Student + Admin routes — Role 4 owns these pages */}
            <Route path="/spaces" element={
              <ProtectedRoute>
                <Layout alertCount={alertCount}>
                  <div className="p-6" style={{ color: "var(--text-muted)" }}>Spaces — Role 4</div>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/bookings" element={
              <ProtectedRoute>
                <Layout alertCount={alertCount}>
                  <div className="p-6" style={{ color: "var(--text-muted)" }}>Bookings — Role 4</div>
                </Layout>
              </ProtectedRoute>
            } />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
}