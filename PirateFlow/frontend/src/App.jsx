import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { WebSocketProvider } from "./context/WebSocketContext";
import TopBar from "./components/common/TopBar";
import Sidebar from "./components/common/Sidebar";
import Header from "./components/common/Header";
import Landing from "./pages/public/Landing";
import Login from "./pages/public/Login";
import Events from "./pages/public/Events";
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

// ─── Public Layout (TopBar only) ─────────────────────────────────────────────
function PublicLayout({ children }) {
  return (
    <div className="app-public">
      <TopBar />
      <div className="app-public-content">
        {children}
      </div>
    </div>
  );
}

// ─── Admin Layout (Sidebar + Header) ─────────────────────────────────────────
function AdminLayout({ children, alertCount }) {
  return (
    <div className="app-admin">
      <Sidebar alertCount={alertCount} />
      <div className="app-admin-body">
        <Header alertCount={alertCount} />
        <main className="app-admin-main">
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
            <Route path="/events" element={<PublicLayout><Events /></PublicLayout>} />
            <Route path="/spaces/:buildingId" element={<PublicLayout><BuildingDetail /></PublicLayout>} />
            <Route path="/spaces" element={<Navigate to="/" replace />} />

            {/* Protected (uses public layout) */}
            <Route path="/bookings/new" element={
              <ProtectedRoute><PublicLayout><CreateBooking /></PublicLayout></ProtectedRoute>
            } />
            <Route path="/bookings" element={
              <ProtectedRoute><PublicLayout><MyBookings /></PublicLayout></ProtectedRoute>
            } />

            {/* Admin */}
            <Route path="/dashboard" element={<AdminRoute><AdminLayout><Dashboard /></AdminLayout></AdminRoute>} />
            <Route path="/analytics" element={<AdminRoute><AdminLayout><Analytics /></AdminLayout></AdminRoute>} />
            <Route path="/revenue" element={<AdminRoute><AdminLayout><Revenue /></AdminLayout></AdminRoute>} />
            <Route path="/alerts" element={<AdminRoute><AdminLayout><Alerts /></AdminLayout></AdminRoute>} />
            <Route path="/admin/spaces" element={<AdminRoute><AdminLayout><ManageSpaces /></AdminLayout></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminLayout><ManageUsers /></AdminLayout></AdminRoute>} />
            <Route path="/admin/cameras" element={<AdminRoute><AdminLayout><Cameras /></AdminLayout></AdminRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
}
