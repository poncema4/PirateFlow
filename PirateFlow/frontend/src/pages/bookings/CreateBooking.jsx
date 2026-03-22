import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import AvailabilityTimeline from "../../components/booking/AvailabilityTimeline";
import { BOOKING_TYPE_OPTIONS, ROOM_TYPE_LABELS } from "../../constants/rooms";

// ─── Time Helpers ─────────────────────────────────────────────────────────────
function generateTimes(startHour = 8, endHour = 21, stepMins = 30) {
  const times = [];
  for (let mins = startHour * 60; mins <= endHour * 60 + 30; mins += stepMins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 21 || (h === 21 && m > 30)) break;
    times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return times;
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

function formatDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function toMins(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function toISO(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00Z`;
}

const START_TIMES = generateTimes(8, 21, 30);

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function Section({ number, title, children }) {
  return (
    <div className="booking-section">
      <div className="booking-section-header">
        <span className="booking-section-number">
          {number}
        </span>
        <h2 className="booking-section-title">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Label + Input row ────────────────────────────────────────────────────────
function Field({ label, children, error }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
      </label>
      {children}
      {error && (
        <p className="form-error">{error}</p>
      )}
    </div>
  );
}

// ─── Success State ────────────────────────────────────────────────────────────
function BookingSuccess({ booking, onBookAnother }) {
  const navigate = useNavigate();
  return (
    <div className="booking-success">
      <div className="booking-success-icon">
        ✓
      </div>
      <div>
        <h2>Booking Confirmed!</h2>
        <p>Your room has been reserved.</p>
      </div>

      <div className="summary-card">
        <Row label="Room"     value={booking.room_name} />
        <Row label="Building" value={booking.building_name} />
        <Row
          label="Date"
          value={formatDate(booking.start_time.split("T")[0])}
        />
        <Row
          label="Time"
          value={`${formatTime(booking.start_time.split("T")[1].slice(0, 5))} – ${formatTime(booking.end_time.split("T")[1].slice(0, 5))}`}
        />
        <Row label="Title" value={booking.title} />
        <Row
          label="Status"
          value={<span style={{ color: "var(--success)", fontWeight: 600 }}>Confirmed</span>}
        />
      </div>

      <div className="booking-success-actions">
        <button
          className="btn btn-primary"
          onClick={() => navigate("/bookings")}
        >
          View My Bookings
        </button>
        <button
          className="btn btn-secondary"
          onClick={onBookAnother}
        >
          Book Another Room
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="summary-row">
      <span className="summary-row-label">{label}</span>
      <span className="summary-row-value">{value}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CreateBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  // ── Pre-filled from query params ───────────────────────────────────────────
  const initialRoomId   = searchParams.get("roomId")    || "";
  const initialRoomName = searchParams.get("roomName")  || "";
  const initialDate     = searchParams.get("date")      || todayStr();
  const initialStart    = searchParams.get("startTime") || "";
  const initialEnd      = searchParams.get("endTime")   || "";

  // ── Form state ─────────────────────────────────────────────────────────────
  const [roomId,       setRoomId]       = useState(initialRoomId);
  const [roomInfo,     setRoomInfo]     = useState(null);
  const [roomLoading,  setRoomLoading]  = useState(!!initialRoomId);

  const [allRooms,     setAllRooms]     = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(!initialRoomId);

  const [date,      setDate]      = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime,   setEndTime]   = useState(initialEnd);

  const [slots,        setSlots]        = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [title,       setTitle]       = useState("");
  const [bookingType, setBookingType] = useState("internal_student");

  const [submitting,       setSubmitting]       = useState(false);
  const [submitError,      setSubmitError]      = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const [errors, setErrors] = useState({});

  // ── Load room list (when no pre-selection) ─────────────────────────────────
  useEffect(() => {
    if (!initialRoomId) {
      api.getRooms({ page_size: 200 }).then((d) => setAllRooms(d.items || [])).finally(() => setRoomsLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load selected room info ────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) { setRoomInfo(null); return; }
    setRoomLoading(true);
    api.getRoom(roomId)
      .then(setRoomInfo)
      .catch(() => setRoomInfo(null))
      .finally(() => setRoomLoading(false));
  }, [roomId]);

  // ── Load availability when room or date changes ────────────────────────────
  useEffect(() => {
    if (!roomId || !date) return;
    setSlotsLoading(true);
    api.getRoomAvailability(roomId, date)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [roomId, date]);

  // ── Derived: valid end times (> start, <= start + 4h, <= 22:00) ────────────
  const endTimes = useMemo(() => {
    if (!startTime) return [];
    const startMins = toMins(startTime);
    const maxMins   = Math.min(startMins + 240, 22 * 60);
    const times = [];
    for (let m = startMins + 30; m <= maxMins; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      times.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
    return times;
  }, [startTime]);

  // Reset end time if it's no longer valid
  useEffect(() => {
    if (endTime && endTimes.length > 0 && !endTimes.includes(endTime)) {
      setEndTime("");
    }
  }, [endTimes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conflict detection ─────────────────────────────────────────────────────
  const hasConflict = useMemo(() => {
    if (!startTime || !endTime || slots.length === 0) return false;
    return slots.some(
      (s) => s.status === "booked" && s.start_time < endTime && s.end_time > startTime
    );
  }, [startTime, endTime, slots]);

  // ── Validate ───────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!roomId)    e.room      = "Please select a room.";
    if (!date)      e.date      = "Please select a date.";
    if (!startTime) e.startTime = "Please select a start time.";
    if (!endTime)   e.endTime   = "Please select an end time.";
    if (hasConflict) e.conflict = "Selected time overlaps an existing booking.";
    if (!title.trim()) e.title  = "Please enter a title for this booking.";

    if (date && startTime) {
      const selected = new Date(`${date}T${startTime}:00Z`);
      if (selected <= new Date()) e.startTime = "Start time must be in the future.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const booking = await api.createBooking({
        room_id:      roomId,
        title:        title.trim(),
        start_time:   toISO(date, startTime),
        end_time:     toISO(date, endTime),
        booking_type: bookingType,
      });
      setConfirmedBooking(booking);
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setSubmitError("This time slot was just booked by someone else. Please choose another time.");
        setSlotsLoading(true);
        api.getRoomAvailability(roomId, date).then(setSlots).finally(() => setSlotsLoading(false));
      } else if (status === 422) {
        setSubmitError(err.response?.data?.detail || "Invalid booking details. Please check your inputs.");
      } else {
        setSubmitError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (confirmedBooking) {
    return (
      <div className="booking-page">
        <BookingSuccess
          booking={confirmedBooking}
          onBookAnother={() => navigate("/")}
        />
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="booking-page">

      {/* Breadcrumb */}
      <nav>
        <Link to="/" className="breadcrumb">
          ← Campus Spaces
        </Link>
      </nav>

      {/* ── Section 1: Room ─────────────────────────────────────────────────── */}
      <Section number="1" title="Select Room">
        {roomId && roomInfo ? (
          <div className="booking-room-info">
            <div>
              <p className="booking-room-name">
                {roomInfo.name}
              </p>
              <p className="booking-room-meta">
                {roomInfo.building_name} · {roomInfo.floor_name} · {ROOM_TYPE_LABELS[roomInfo.room_type] || roomInfo.room_type} · {roomInfo.capacity} people
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setRoomId(""); setRoomInfo(null); setSlots([]); setStartTime(""); setEndTime(""); }}
            >
              Change
            </button>
          </div>
        ) : roomId && roomLoading ? (
          <div className="skeleton" />
        ) : (
          <Field label="Room" error={errors.room}>
            {roomsLoading ? (
              <div className="skeleton" />
            ) : (
              <select
                className="form-select"
                value={roomId}
                onChange={(e) => { setRoomId(e.target.value); setErrors((p) => ({ ...p, room: "" })); }}
              >
                <option value="">— Select a room —</option>
                {allRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.building_name} ({r.capacity} people)
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
      </Section>

      {/* ── Section 2: Date & Time ───────────────────────────────────────────── */}
      <Section number="2" title="Date & Time">
        <Field label="Date" error={errors.date}>
          <input
            className="form-input"
            type="date"
            value={date}
            min={todayStr()}
            onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: "" })); }}
          />
        </Field>

        <div className="form-row">
          <Field label="Start Time" error={errors.startTime}>
            <select
              className="form-select"
              value={startTime}
              onChange={(e) => { setStartTime(e.target.value); setEndTime(""); setErrors((p) => ({ ...p, startTime: "", conflict: "" })); }}
            >
              <option value="">— Select —</option>
              {START_TIMES.map((t) => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
          </Field>

          <Field label="End Time" error={errors.endTime}>
            <select
              className="form-select"
              value={endTime}
              disabled={!startTime}
              onChange={(e) => { setEndTime(e.target.value); setErrors((p) => ({ ...p, endTime: "", conflict: "" })); }}
            >
              <option value="">— Select —</option>
              {endTimes.map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)} ({(toMins(t) - toMins(startTime)) / 60}h)
                </option>
              ))}
            </select>
          </Field>
        </div>

        {(hasConflict || errors.conflict) && (
          <div className="alert-danger">
            <span>⚠</span>
            <p>This time overlaps an existing booking. Please choose a different time.</p>
          </div>
        )}

        {roomId && (
          <div className="form-group">
            <p className="form-label">
              Availability
            </p>
            <AvailabilityTimeline
              slots={slots}
              date={date}
              highlightRange={startTime && endTime ? { start: startTime, end: endTime } : null}
              loading={slotsLoading}
            />
          </div>
        )}
      </Section>

      {/* ── Section 3: Details ───────────────────────────────────────────────── */}
      <Section number="3" title="Details">
        <Field label="Title / Purpose" error={errors.title}>
          <input
            className="form-input"
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
            placeholder="e.g. CS 101 Study Group"
            maxLength={100}
          />
        </Field>

        {!isStudent && (
          <Field label="Booking Type">
            <select
              className="form-select"
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value)}
            >
              {BOOKING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        )}
      </Section>

      {/* ── Section 4: Confirm ───────────────────────────────────────────────── */}
      <Section number="4" title="Confirm">
        <div className="summary-card">
          <Row label="Room"   value={roomInfo?.name || (roomId ? "Loading..." : "Not selected")} />
          <Row label="Date"   value={date ? formatDate(date) : "Not selected"} />
          <Row label="Time"   value={startTime && endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : "Not selected"} />
          <Row label="Title"  value={title.trim() || <span className="form-hint">Not entered</span>} />
          {!isStudent && <Row label="Type" value={BOOKING_TYPE_OPTIONS.find((o) => o.value === bookingType)?.label || bookingType} />}
        </div>

        {submitError && (
          <div className="alert-danger">
            <p>{submitError}</p>
          </div>
        )}

        <button
          className="booking-confirm-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting && <span className="spinner" />}
          {submitting ? "Confirming..." : "Confirm Booking"}
        </button>
      </Section>
    </div>
  );
}
