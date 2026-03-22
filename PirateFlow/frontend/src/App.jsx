import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { WebSocketProvider } from "./context/WebSocketContext";
import Sidebar from "./components/common/Sidebar";
import Header from "./components/common/Header";
import Landing from "./pages/public/Landing";
import Login from "./pages/public/Login";
import Dashboard from "./pages/admin/Dashboard";
import Analytics from "./pages/admin/Analytics";
import Revenue from "./pages/admin/Revenue";
import Alerts from "./pages/admin/Alerts";
import ManageSpaces from "./pages/admin/ManageSpaces";
import ManageUsers from "./pages/admin/ManageUsers";
import Cameras from "./pages/admin/Cameras";
import BuildingDetail from "./pages/spaces/BuildingDetail";
import CreateBooking from "./pages/bookings/CreateBooking";
import MyBookings from "./pages/bookings/MyBookings";

// Re-export for any legacy imports
export { useAuth } from "./hooks/useAuth";
export { AuthContext } from "./hooks/useAuth";

// ─── Route Guards ────────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// ─── Layout ──────────────────────────────────────────────────────────────────
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

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/spaces/:buildingId" element={<Layout><BuildingDetail /></Layout>} />
            <Route path="/spaces" element={<Navigate to="/" replace />} />

            {/* Protected */}
            <Route path="/bookings/new" element={
              <ProtectedRoute><Layout><CreateBooking /></Layout></ProtectedRoute>
            } />
            <Route path="/bookings" element={
              <ProtectedRoute><Layout><MyBookings /></Layout></ProtectedRoute>
            } />

            {/* Admin */}
            <Route path="/dashboard" element={<AdminRoute><Layout><Dashboard /></Layout></AdminRoute>} />
            <Route path="/analytics" element={<AdminRoute><Layout><Analytics /></Layout></AdminRoute>} />
            <Route path="/revenue" element={<AdminRoute><Layout><Revenue /></Layout></AdminRoute>} />
            <Route path="/alerts" element={<AdminRoute><Layout><Alerts /></Layout></AdminRoute>} />
            <Route path="/admin/spaces" element={<AdminRoute><Layout><ManageSpaces /></Layout></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><Layout><ManageUsers /></Layout></AdminRoute>} />
            <Route path="/admin/cameras" element={<AdminRoute><Layout><Cameras /></Layout></AdminRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
}
