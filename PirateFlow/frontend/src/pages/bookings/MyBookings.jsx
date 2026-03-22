import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

function formatDateLong(isoStr) {
  return new Date(isoStr).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

const BOOKING_TYPE_LABELS = {
  internal_student: "Student", internal_staff: "Staff",
  internal_department: "Department", external: "External",
};

const STATUS_STYLES = {
  confirmed: { label: "Confirmed", bg: "rgba(37,99,235,0.1)", border: "rgba(37,99,235,0.3)", color: "var(--accent)" },
  completed: { label: "Completed", bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.3)", color: "var(--text-muted)" },
  cancelled: { label: "Cancelled", bg: "rgba(220,38,38,0.1)", border: "rgba(220,38,38,0.3)", color: "var(--danger)" },
  no_show:   { label: "No-show",   bg: "rgba(234,88,12,0.1)", border: "rgba(234,88,12,0.3)", color: "var(--warning)" },
};

function isUpcoming(b) { return b.status === "confirmed" && new Date(b.start_time) > new Date(); }
function isPast(b) { return b.status === "completed" || (b.status === "confirmed" && new Date(b.end_time) <= new Date()); }
function isCancelled(b) { return b.status === "cancelled" || b.status === "no_show"; }

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.completed;
  return (
    <span className="status-badge" style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.label}
    </span>
  );
}

function BookingCard({ booking, onCancel, cancelling, isAdmin, currentUserId }) {
  const navigate = useNavigate();
  const upcoming = isUpcoming(booking);
  const isOwner = booking.user_id === currentUserId;

  return (
    <div className="booking-card">
      <div className="booking-card-top">
        <div>
          <p className="booking-card-title">{booking.title}</p>
          <p className="booking-card-room">
            {booking.room_name} · {booking.building_name}
            {isAdmin && booking.user_name && (
              <> · Booked by {booking.user_name}</>
            )}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="booking-card-details">
        <span className="booking-card-date">{formatDate(booking.start_time)}</span>
        <span className="booking-card-time">{formatTime(booking.start_time)} – {formatTime(booking.end_time)}</span>
        <span className="booking-card-type">{BOOKING_TYPE_LABELS[booking.booking_type] || booking.booking_type}</span>
      </div>

      {upcoming && (
        <div className="booking-card-actions">
          {isOwner && (
            <button
              className="booking-action-btn"
              onClick={() => navigate(`/bookings/new?roomId=${booking.room_id}&roomName=${encodeURIComponent(booking.room_name)}`)}
            >
              Book Again
            </button>
          )}
          {(isOwner || isAdmin) && (
            <button
              className="booking-action-btn danger"
              onClick={() => onCancel(booking)}
              disabled={cancelling === booking.id}
            >
              {cancelling === booking.id ? "Cancelling..." : "Cancel"}
            </button>
          )}
        </div>
      )}

      {isPast(booking) && isOwner && (
        <div className="booking-card-actions">
          <button
            className="booking-action-btn"
            onClick={() => navigate(`/bookings/new?roomId=${booking.room_id}&roomName=${encodeURIComponent(booking.room_name)}`)}
          >
            Book Again
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab }) {
  const msgs = {
    upcoming:  { heading: "No upcoming bookings", sub: "Browse available spaces and make your first reservation." },
    past:      { heading: "No past bookings", sub: "Completed reservations will appear here." },
    cancelled: { heading: "No cancelled bookings", sub: "Cancelled reservations will show up here." },
  };
  const { heading, sub } = msgs[tab] ?? msgs.upcoming;
  return (
    <div className="empty-state">
      <h3>{heading}</h3>
      <p>{sub}</p>
      {tab === "upcoming" && <Link to="/spaces" className="btn btn-primary">Browse Spaces</Link>}
    </div>
  );
}

function CancelDialog({ booking, onConfirm, onClose, loading }) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div>
          <h3 className="modal-title">Cancel Booking?</h3>
          <p>
            Are you sure you want to cancel <strong>{booking.title}</strong> on {formatDateLong(booking.start_time)}?
          </p>
        </div>
        <div className="summary-card">
          <div className="summary-row">
            <span className="summary-row-label">{booking.room_name} · {booking.building_name}</span>
          </div>
          <div className="summary-row">
            <span className="summary-row-label">{formatTime(booking.start_time)} – {formatTime(booking.end_time)}</span>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary btn-block" onClick={onClose} disabled={loading}>Keep Booking</button>
          <button className="btn btn-danger btn-block" onClick={onConfirm} disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? "Cancelling..." : "Yes, Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tab({ label, count, active, onClick }) {
  return (
    <button className={`tab-btn ${active ? "active" : ""}`} onClick={onClick}>
      {label}
      {count > 0 && <span className="tab-count">{count}</span>}
    </button>
  );
}

export default function MyBookings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState("");

  const fetchBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getBookings({ page_size: 100 });
      setBookings(data.items || []);
    } catch {
      setError("Failed to load bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const { upcoming, past, cancelled } = useMemo(() => ({
    upcoming:  bookings.filter(isUpcoming).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    past:      bookings.filter(isPast).sort((a, b) => new Date(b.start_time) - new Date(a.start_time)),
    cancelled: bookings.filter(isCancelled).sort((a, b) => new Date(b.start_time) - new Date(a.start_time)),
  }), [bookings]);

  const tabItems = activeTab === "upcoming" ? upcoming : activeTab === "past" ? past : cancelled;

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    setCancellingId(cancelTarget.id);
    setCancelError("");
    try {
      const updated = await api.cancelBooking(cancelTarget.id);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setCancelTarget(null);
    } catch (err) {
      setCancelError(err.response?.data?.detail || "Failed to cancel booking.");
    } finally {
      setCancelLoading(false);
      setCancellingId(null);
    }
  };

  const pageTitle = isAdmin ? "All Bookings" : "My Bookings";
  const pageSubtitle = isAdmin ? "View and manage all room reservations" : "Manage your room reservations";

  return (
    <div className="bookings-page">
      <div className="bookings-header">
        <div>
          <h1>{pageTitle}</h1>
          <p>{pageSubtitle}</p>
        </div>
        <Link to="/spaces" className="btn btn-primary">+ New Booking</Link>
      </div>

      {cancelError && (
        <div className="alert alert-danger">
          <span>{cancelError}</span>
          <button className="booking-action-btn" onClick={() => setCancelError("")}>✕</button>
        </div>
      )}

      {error && (
        <div className="empty-state">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchBookings}>Retry</button>
        </div>
      )}

      {!error && (
        <>
          <div className="tab-bar">
            <Tab label="Upcoming" count={upcoming.length} active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")} />
            <Tab label="Past" count={past.length} active={activeTab === "past"} onClick={() => setActiveTab("past")} />
            <Tab label="Cancelled" count={cancelled.length} active={activeTab === "cancelled"} onClick={() => setActiveTab("cancelled")} />
          </div>

          <div>
            {loading ? (
              <>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 10 }} />)}</>
            ) : tabItems.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              tabItems.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onCancel={setCancelTarget}
                  cancelling={cancellingId}
                  isAdmin={isAdmin}
                  currentUserId={user?.id}
                />
              ))
            )}
          </div>
        </>
      )}

      {cancelTarget && (
        <CancelDialog
          booking={cancelTarget}
          onConfirm={handleCancelConfirm}
          onClose={() => { if (!cancelLoading) setCancelTarget(null); }}
          loading={cancelLoading}
        />
      )}
    </div>
  );
}
