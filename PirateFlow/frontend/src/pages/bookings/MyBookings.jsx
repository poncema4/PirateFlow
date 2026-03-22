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
    <div
      className="rounded-xl animate-pulse"
      style={{
        height: 100,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    />
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.completed;
  return (
    <span
      className="rounded-full text-xs font-semibold flex-shrink-0"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: "2px 8px" }}
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
    <div
      className="rounded-xl flex flex-col gap-2.5"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        padding: "14px 16px",
        transition: "border-color 150ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(0,75,141,0.25)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      {/* Top row: title + status badge */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5" style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {booking.title}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {booking.room_name} · {booking.building_name}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Date / time / type row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="rounded-md text-xs flex-shrink-0"
          style={{ background: "var(--bg-primary)", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "4px 10px" }}
        >
          {formatDate(booking.start_time)}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
          {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
          {BOOKING_TYPE_LABELS[booking.booking_type] || booking.booking_type}
        </span>
      </div>

      {/* Actions */}
      {upcoming && (
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={() =>
              navigate(`/bookings/new?roomId=${booking.room_id}&roomName=${encodeURIComponent(booking.room_name)}`)
            }
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 11,
              color: "var(--text-muted)",
              cursor: "pointer",
              transition: "border-color 150ms, color 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            Book Again
          </button>

          <button
            onClick={() => onCancel(booking)}
            disabled={cancelling === booking.id}
            style={{
              background: "transparent",
              border: "1px solid rgba(232,68,90,0.3)",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 11,
              color: "var(--danger)",
              cursor: cancelling === booking.id ? "not-allowed" : "pointer",
              opacity: cancelling === booking.id ? 0.5 : 1,
              transition: "border-color 150ms, opacity 150ms",
            }}
            onMouseEnter={(e) => {
              if (cancelling !== booking.id)
                e.currentTarget.style.borderColor = "var(--danger)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(232,68,90,0.3)";
            }}
          >
            {cancelling === booking.id ? "Cancelling..." : "Cancel Booking"}
          </button>
        </div>
      )}

      {/* Past: "Book Again" button */}
      {isPast(booking) && (
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={() =>
              navigate(`/bookings/new?roomId=${booking.room_id}&roomName=${encodeURIComponent(booking.room_name)}`)
            }
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 11,
              color: "var(--text-muted)",
              cursor: "pointer",
              transition: "border-color 150ms, color 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
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
    <div
      className="flex flex-col items-center gap-2.5 py-14"
      style={{ color: "var(--text-muted)", textAlign: "center" }}
    >
      <p style={{ fontSize: 32, lineHeight: 1 }}>{icon}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{heading}</p>
      <p style={{ fontSize: 12 }}>{sub}</p>
      {tab === "upcoming" && (
        <Link
          to="/"
          style={{
            marginTop: 6,
            display: "inline-block",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 12,
            padding: "8px 18px",
            borderRadius: 7,
            textDecoration: "none",
            transition: "opacity 150ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
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
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", zIndex: 100, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl flex flex-col gap-3.5"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxWidth: 380, width: "100%", padding: "22px 24px" }}
      >
        <div>
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            Cancel Booking?
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Are you sure you want to cancel{" "}
            <strong style={{ color: "var(--text-primary)" }}>{booking.title}</strong> on{" "}
            {formatDateLong(booking.start_time)}?
          </p>
        </div>

        <div
          className="rounded-lg flex flex-col gap-1"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", padding: "10px 12px" }}
        >
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {booking.room_name} · {booking.building_name}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 7,
              padding: "9px 0",
              fontSize: 13,
              color: "var(--text-muted)",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "border-color 150ms",
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.borderColor = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            Keep Booking
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              background: loading ? "var(--border)" : "rgba(232,68,90,0.15)",
              border: `1px solid ${loading ? "var(--border)" : "rgba(232,68,90,0.4)"}`,
              borderRadius: 7,
              padding: "9px 0",
              fontSize: 13,
              fontWeight: 600,
              color: loading ? "var(--text-muted)" : "var(--danger)",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 150ms",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = "0.82"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {loading && (
              <span
                style={{
                  width: 13,
                  height: 13,
                  border: "2px solid rgba(232,68,90,0.3)",
                  borderTopColor: "var(--danger)",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.7s linear infinite",
                }}
              />
            )}
            {loading ? "Cancelling..." : "Yes, Cancel"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────
function Tab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
        padding: "8px 3px",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        cursor: "pointer",
        transition: "color 150ms, border-color 150ms",
        display: "flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--text-primary)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--text-muted)"; }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            background: active ? "var(--accent)" : "var(--border)",
            color: active ? "#000" : "var(--text-muted)",
            borderRadius: 99,
            padding: "1px 5px",
            transition: "background 150ms, color 150ms",
          }}
        >
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
    <div className="flex flex-col gap-5" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 24px" }}>

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.4px",
            }}
          >
            My Bookings
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Manage your room reservations
          </p>
        </div>
        <Link
          to="/"
          style={{
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 12,
            padding: "8px 16px",
            borderRadius: 7,
            textDecoration: "none",
            transition: "opacity 150ms",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          + New Booking
        </Link>
      </div>

      {/* Cancel error banner */}
      {cancelError && (
        <div
          className="rounded-lg flex items-center justify-between gap-3"
          style={{ background: "rgba(232,68,90,0.08)", border: "1px solid rgba(232,68,90,0.25)", padding: "10px 14px" }}
        >
          <p style={{ fontSize: 12, color: "var(--danger)" }}>{cancelError}</p>
          <button
            onClick={() => setCancelError("")}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-3 py-10" style={{ textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{error}</p>
          <button
            onClick={fetchBookings}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "8px 20px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!error && (
        <>
          {/* Tabs */}
          <div
            className="flex gap-5"
            style={{ borderBottom: "1px solid var(--border)", paddingBottom: 0 }}
          >
            <Tab label="Upcoming"  count={upcoming.length}  active={activeTab === "upcoming"}  onClick={() => setActiveTab("upcoming")}  />
            <Tab label="Past"      count={past.length}      active={activeTab === "past"}      onClick={() => setActiveTab("past")}      />
            <Tab label="Cancelled" count={cancelled.length} active={activeTab === "cancelled"} onClick={() => setActiveTab("cancelled")} />
          </div>

          {/* List */}
          <div className="flex flex-col gap-2.5">
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
