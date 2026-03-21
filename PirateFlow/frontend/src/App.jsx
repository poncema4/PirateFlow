import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, createContext, useContext } from "react";
import { WebSocketProvider } from "./context/WebSocketContext";
import { tokenStorage } from "./api/client";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Revenue from "./pages/Revenue";
import Alerts from "./pages/Alerts";
import Login from "./pages/Login";
import Spaces from "./pages/Spaces";
import BuildingDetail from "./pages/BuildingDetail";
import RoomDetail from "./pages/RoomDetail";
import CreateBooking from "./pages/CreateBooking";
import MyBookings from "./pages/MyBookings";

// ─── Auth Context ─────────────────────────────────────────────────────────────
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("pf_user");
    return saved ? JSON.parse(saved) : null;
  });

  // userData: { id?, email, first_name?, last_name?, role, name? }
  // tokens:   { access_token, refresh_token } (optional — omit for temp/stub login)
  const login = (userData, tokens) => {
    // Normalize: ensure `name` field exists for Sidebar/Header display
    const normalized = {
      ...userData,
      name: userData.name ?? (`${userData.first_name ?? ""} ${userData.last_name ?? ""}`.trim() || userData.email),
    };
    if (tokens) tokenStorage.set(tokens.access_token, tokens.refresh_token);
    localStorage.setItem("pf_user", JSON.stringify(normalized));
    setUser(normalized);
  };

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isAdmin, login, logout }}>
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
            <Route path="/login" element={<Login />} />

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

            {/* ── Role 4: Student + Staff routes ─────────────────────────── */}
            <Route path="/spaces" element={
              <ProtectedRoute>
                <Layout alertCount={alertCount}><Spaces /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/spaces/:buildingId" element={
              <ProtectedRoute>
                <Layout alertCount={alertCount}><BuildingDetail /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/spaces/:buildingId/:roomId" element={
              <ProtectedRoute>
                <Layout alertCount={alertCount}><RoomDetail /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/bookings/new" element={
              <ProtectedRoute>
                <Layout alertCount={alertCount}><CreateBooking /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/bookings" element={
              <ProtectedRoute>
                <Layout alertCount={alertCount}><MyBookings /></Layout>
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