import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(isoStr) {
  const d = new Date(isoStr);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateLong(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const BOOKING_TYPE_LABELS = {
  internal_student:    "Student",
  internal_staff:      "Staff",
  internal_department: "Department",
  external:            "External",
};

const STATUS_STYLES = {
  confirmed:  { label: "Confirmed",  bg: "rgba(0,75,141,0.1)",    border: "rgba(0,75,141,0.3)",  color: "var(--accent)"     },
  completed:  { label: "Completed",  bg: "rgba(90,96,112,0.15)",   border: "rgba(90,96,112,0.3)",  color: "var(--text-muted)" },
  cancelled:  { label: "Cancelled",  bg: "rgba(232,68,90,0.1)",    border: "rgba(232,68,90,0.3)",  color: "var(--danger)"     },
  no_show:    { label: "No-show",    bg: "rgba(245,166,35,0.1)",   border: "rgba(245,166,35,0.3)", color: "var(--warning)"    },
};

function isUpcoming(booking) {
  return booking.status === "confirmed" && new Date(booking.start_time) > new Date();
}
function isPast(booking) {
  return (
    booking.status === "completed" ||
    (booking.status === "confirmed" && new Date(booking.end_time) <= new Date())
  );
}
function isCancelled(booking) {
  return booking.status === "cancelled" || booking.status === "no_show";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="skeleton" />
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.completed;
  return (
    <span
      className="status-badge"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────
function BookingCard({ booking, onCancel, cancelling }) {
  const navigate = useNavigate();
  const upcoming = isUpcoming(booking);

  return (
    <div className="booking-card">
      {/* Top row: title + status badge */}
      <div className="booking-card-top">
        <div>
          <p className="booking-card-title">
            {booking.title}
          </p>
          <p className="booking-card-room">
            {booking.room_name} · {booking.building_name}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Date / time / type row */}
      <div className="booking-card-details">
        <span className="booking-card-date">
          {formatDate(booking.start_time)}
        </span>
        <span className="booking-card-time">
          {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
        </span>
        <span className="booking-card-type">
          {BOOKING_TYPE_LABELS[booking.booking_type] || booking.booking_type}
        </span>
      </div>

      {/* Actions */}
      {upcoming && (
        <div className="booking-card-actions">
          <button
            className="booking-action-btn"
            onClick={() =>
              navigate(`/bookings/new?roomId=${booking.room_id}&roomName=${encodeURIComponent(booking.room_name)}`)
            }
          >
            Book Again
          </button>

          <button
            className="booking-action-btn danger"
            onClick={() => onCancel(booking)}
            disabled={cancelling === booking.id}
          >
            {cancelling === booking.id ? "Cancelling..." : "Cancel Booking"}
          </button>
        </div>
      )}

      {/* Past: "Book Again" button */}
      {isPast(booking) && (
        <div className="booking-card-actions">
          <button
            className="booking-action-btn"
            onClick={() =>
              navigate(`/bookings/new?roomId=${booking.room_id}&roomName=${encodeURIComponent(booking.room_name)}`)
            }
          >
            Book Again
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ tab }) {
  const msgs = {
    upcoming:  { icon: "◫", heading: "No upcoming bookings", sub: "Browse available spaces and make your first reservation." },
    past:      { icon: "◻", heading: "No past bookings",     sub: "Your completed reservations will appear here."           },
    cancelled: { icon: "✕", heading: "No cancelled bookings", sub: "Any cancelled reservations will show up here."          },
  };
  const { icon, heading, sub } = msgs[tab] ?? msgs.upcoming;

  return (
    <div className="empty-state">
      <p>{icon}</p>
      <h3>{heading}</h3>
      <p>{sub}</p>
      {tab === "upcoming" && (
        <Link to="/" className="btn btn-primary">
          Browse Spaces
        </Link>
      )}
    </div>
  );
}

// ─── Cancel Confirm Dialog ────────────────────────────────────────────────────
function CancelDialog({ booking, onConfirm, onClose, loading }) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card">
        <div>
          <h3 className="modal-title">
            Cancel Booking?
          </h3>
          <p>
            Are you sure you want to cancel{" "}
            <strong>{booking.title}</strong> on{" "}
            {formatDateLong(booking.start_time)}?
          </p>
        </div>

        <div className="summary-card">
          <div className="summary-row">
            <span className="summary-row-label">
              {booking.room_name} · {booking.building_name}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-row-label">
              {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
            </span>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-secondary btn-block"
            onClick={onClose}
            disabled={loading}
          >
            Keep Booking
          </button>
          <button
            className="btn btn-danger btn-block"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <span className="spinner" />}
            {loading ? "Cancelling..." : "Yes, Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────
function Tab({ label, count, active, onClick }) {
  return (
    <button
      className={`tab-btn ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {label}
      {count > 0 && (
        <span className="tab-count">
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyBookings() {
  const [bookings,    setBookings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [activeTab,   setActiveTab]   = useState("upcoming");

  const [cancelTarget,   setCancelTarget]   = useState(null);
  const [cancelLoading,  setCancelLoading]  = useState(false);
  const [cancellingId,   setCancellingId]   = useState(null);
  const [cancelError,    setCancelError]    = useState("");

  // ── Fetch all user bookings ─────────────────────────────────────────────────
  const fetchBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getBookings();
      setBookings(data.items || []);
    } catch {
      setError("Failed to load bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // ── Split into tabs ─────────────────────────────────────────────────────────
  const { upcoming, past, cancelled } = useMemo(() => {
    const upcoming  = bookings.filter(isUpcoming).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    const past      = bookings.filter(isPast).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    const cancelled = bookings.filter(isCancelled).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    return { upcoming, past, cancelled };
  }, [bookings]);

  const tabItems = activeTab === "upcoming" ? upcoming : activeTab === "past" ? past : cancelled;

  // ── Cancel handler ──────────────────────────────────────────────────────────
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
      const msg = err.response?.data?.detail || "Failed to cancel booking. Please try again.";
      setCancelError(msg);
    } finally {
      setCancelLoading(false);
      setCancellingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bookings-page">

      {/* Page header */}
      <div className="bookings-header">
        <div>
          <h1>My Bookings</h1>
          <p>Manage your room reservations</p>
        </div>
        <Link to="/" className="btn btn-primary">
          + New Booking
        </Link>
      </div>

      {/* Cancel error banner */}
      {cancelError && (
        <div className="alert-danger">
          <p>{cancelError}</p>
          <button
            className="booking-action-btn"
            onClick={() => setCancelError("")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="empty-state">
          <p>{error}</p>
          <button
            className="btn btn-primary"
            onClick={fetchBookings}
          >
            Retry
          </button>
        </div>
      )}

      {!error && (
        <>
          {/* Tabs */}
          <div className="tab-bar">
            <Tab label="Upcoming"  count={upcoming.length}  active={activeTab === "upcoming"}  onClick={() => setActiveTab("upcoming")}  />
            <Tab label="Past"      count={past.length}      active={activeTab === "past"}      onClick={() => setActiveTab("past")}      />
            <Tab label="Cancelled" count={cancelled.length} active={activeTab === "cancelled"} onClick={() => setActiveTab("cancelled")} />
          </div>

          {/* List */}
          <div>
            {loading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : tabItems.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              tabItems.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onCancel={setCancelTarget}
                  cancelling={cancellingId}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Cancel confirmation dialog */}
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
