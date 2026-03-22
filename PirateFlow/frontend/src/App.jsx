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
import FaceRegister from "./pages/public/FaceRegister";
import FaceVerify from "./pages/public/FaceVerify";

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

// ─── Adaptive Layout: admin stays in sidebar, students get TopBar ────────────
function BookingLayout({ children }) {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminLayout>{children}</AdminLayout>;
  return <PublicLayout>{children}</PublicLayout>;
}

// ─── Home: admin → dashboard, everyone else → landing ───────────────────────
function Home() {
  const { user } = useAuth();
  if (user?.role === "admin") return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/events" element={<BookingLayout><Events /></BookingLayout>} />
            <Route path="/spaces/:buildingId" element={<BookingLayout><BuildingDetail /></BookingLayout>} />
            <Route path="/spaces" element={<BookingLayout><Landing /></BookingLayout>} />

            {/* Protected (uses public layout for students) */}
            <Route path="/bookings/new" element={
              <ProtectedRoute><BookingLayout><CreateBooking /></BookingLayout></ProtectedRoute>
            } />
            <Route path="/bookings" element={
              <ProtectedRoute><BookingLayout><MyBookings /></BookingLayout></ProtectedRoute>
            } />
            <Route path="/face/register" element={<AdminRoute><AdminLayout><FaceRegister /></AdminLayout></AdminRoute>} />
            <Route path="/face/verify" element={<AdminRoute><AdminLayout><FaceVerify /></AdminLayout></AdminRoute>} />

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
