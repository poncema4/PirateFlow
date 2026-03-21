import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../App";
import AvailabilityTimeline from "../components/AvailabilityTimeline";

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

// Convert "HH:MM" to minutes since midnight
function toMins(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

// Build ISO string for backend (UTC)
function toISO(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00Z`;
}

const START_TIMES = generateTimes(8, 21, 30);

const BOOKING_TYPE_OPTIONS = [
  { value: "internal_student",    label: "Student (personal)"     },
  { value: "internal_staff",      label: "Staff (work-related)"   },
  { value: "internal_department", label: "Department event"        },
  { value: "external",            label: "External / community"   },
];

const ROOM_TYPE_LABELS = {
  study_room: "Study Room", computer_lab: "Computer Lab",
  lecture_hall: "Lecture Hall", science_lab: "Science Lab",
  conference_room: "Conference Room", event_space: "Event Space",
  multipurpose: "Multipurpose", classroom: "Classroom",
};

// ─── Section Wrapper ──────────────────────────────────────────────────────────
function Section({ number, title, children }) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex items-center justify-center rounded-full text-sm font-bold flex-shrink-0"
          style={{ width: 28, height: 28, background: "var(--accent)", color: "#000" }}
        >
          {number}
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Label + Input row ────────────────────────────────────────────────────────
function Field({ label, children, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      {children}
      {error && (
        <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>
      )}
    </div>
  );
}

const inputStyle = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 14,
  color: "var(--text-primary)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 150ms",
};

// ─── Success State ────────────────────────────────────────────────────────────
function BookingSuccess({ booking, onBookAnother }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4" style={{ maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
      {/* Animated checkmark */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "rgba(0,200,150,0.15)",
          border: "2px solid var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          animation: "scaleIn 0.3s ease-out",
        }}
      >
        ✓
      </div>
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--accent)",
            marginBottom: 8,
          }}
        >
          Booking Confirmed!
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Your room has been reserved.
        </p>
      </div>

      {/* Summary */}
      <div
        className="w-full rounded-xl p-5 flex flex-col gap-3 text-left"
        style={{ background: "var(--bg-card)", border: "1px solid rgba(0,200,150,0.25)" }}
      >
        <Row label="Room"   value={booking.room_name} />
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

      <div className="flex gap-3 w-full">
        <button
          onClick={() => navigate("/bookings")}
          style={{
            flex: 1,
            background: "var(--accent)",
            color: "#000",
            border: "none",
            borderRadius: 8,
            padding: "11px 0",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 150ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          View My Bookings
        </button>
        <button
          onClick={onBookAnother}
          style={{
            flex: 1,
            background: "transparent",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "11px 0",
            fontSize: 14,
            cursor: "pointer",
            transition: "border-color 150ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          Book Another Room
        </button>
      </div>

      <style>{`@keyframes scaleIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span style={{ fontSize: 13, color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", textAlign: "right" }}>{value}</span>
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
  const initialRoomId   = searchParams.get("roomId")   || "";
  const initialRoomName = searchParams.get("roomName") || "";
  const initialDate     = searchParams.get("date")     || todayStr();
  const initialStart    = searchParams.get("startTime") || "";
  const initialEnd      = searchParams.get("endTime")   || "";

  // ── Form state ─────────────────────────────────────────────────────────────
  const [roomId,       setRoomId]       = useState(initialRoomId);
  const [roomInfo,     setRoomInfo]     = useState(null);       // RoomOut from API
  const [roomLoading,  setRoomLoading]  = useState(!!initialRoomId);

  const [allRooms,     setAllRooms]     = useState([]);         // for selector
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

  // Validation errors
  const [errors, setErrors] = useState({});

  // ── Load room list (when no pre-selection) ─────────────────────────────────
  useEffect(() => {
    if (!initialRoomId) {
      api.getRooms().then((d) => setAllRooms(d.items || [])).finally(() => setRoomsLoading(false));
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

  // ── Derived: valid end times (> start, ≤ start + 4h, ≤ 22:00) ─────────────
  const endTimes = useMemo(() => {
    if (!startTime) return [];
    const startMins = toMins(startTime);
    const maxMins   = Math.min(startMins + 240, 22 * 60); // max 4h, max 10pm
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

    // Past time check
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
        // Refresh availability
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
      <div className="p-6" style={{ maxWidth: 860, margin: "0 auto" }}>
        <BookingSuccess
          booking={confirmedBooking}
          onBookAnother={() => navigate("/spaces")}
        />
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 flex flex-col gap-5" style={{ maxWidth: 760, margin: "0 auto" }}>

      {/* Breadcrumb */}
      <nav>
        <Link
          to="/spaces"
          style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", transition: "color 150ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          ← Campus Spaces
        </Link>
      </nav>

      {/* ── Section 1: Room ─────────────────────────────────────────────────── */}
      <Section number="1" title="Select Room">
        {roomId && roomInfo ? (
          // Pre-selected room summary
          <div
            className="rounded-lg p-4 flex items-start justify-between gap-3"
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
          >
            <div className="flex flex-col gap-1">
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                {roomInfo.name}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {roomInfo.building_name} · {roomInfo.floor_name} · {ROOM_TYPE_LABELS[roomInfo.room_type] || roomInfo.room_type} · {roomInfo.capacity} people
              </p>
              {roomInfo.hourly_rate && (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>${roomInfo.hourly_rate}/hr</p>
              )}
            </div>
            <button
              onClick={() => { setRoomId(""); setRoomInfo(null); setSlots([]); setStartTime(""); setEndTime(""); }}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "var(--text-muted)", cursor: "pointer", flexShrink: 0, transition: "border-color 150ms" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              Change
            </button>
          </div>
        ) : roomId && roomLoading ? (
          <div className="animate-pulse rounded-lg" style={{ height: 70, background: "var(--bg-primary)" }} />
        ) : (
          // Room selector
          <Field label="Room" error={errors.room}>
            {roomsLoading ? (
              <div className="animate-pulse rounded-lg" style={{ height: 40, background: "var(--bg-primary)" }} />
            ) : (
              <select
                value={roomId}
                onChange={(e) => { setRoomId(e.target.value); setErrors((p) => ({ ...p, room: "" })); }}
                style={{ ...inputStyle, cursor: "pointer" }}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; }}
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
        {/* Date */}
        <Field label="Date" error={errors.date}>
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: "" })); }}
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; }}
          />
        </Field>

        {/* Start + End time */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Start Time" error={errors.startTime}>
            <select
              value={startTime}
              onChange={(e) => { setStartTime(e.target.value); setEndTime(""); setErrors((p) => ({ ...p, startTime: "", conflict: "" })); }}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; }}
            >
              <option value="">— Select —</option>
              {START_TIMES.map((t) => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
          </Field>

          <Field label="End Time" error={errors.endTime}>
            <select
              value={endTime}
              disabled={!startTime}
              onChange={(e) => { setEndTime(e.target.value); setErrors((p) => ({ ...p, endTime: "", conflict: "" })); }}
              style={{ ...inputStyle, cursor: startTime ? "pointer" : "not-allowed", opacity: startTime ? 1 : 0.5 }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; }}
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

        {/* Conflict warning */}
        {(hasConflict || errors.conflict) && (
          <div
            className="rounded-lg px-4 py-3 flex items-center gap-2"
            style={{ background: "rgba(232,68,90,0.08)", border: "1px solid rgba(232,68,90,0.25)" }}
          >
            <span style={{ color: "var(--danger)", fontSize: 14 }}>⚠</span>
            <p style={{ fontSize: 13, color: "var(--danger)" }}>
              This time overlaps an existing booking. Please choose a different time.
            </p>
          </div>
        )}

        {/* Availability timeline */}
        {roomId && (
          <div className="flex flex-col gap-2">
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
            placeholder="e.g. CS 101 Study Group"
            maxLength={100}
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; }}
          />
        </Field>

        {/* Booking type — hidden for students */}
        {!isStudent && (
          <Field label="Booking Type">
            <select
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; }}
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
        {/* Summary */}
        <div
          className="rounded-lg p-4 flex flex-col gap-2"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
        >
          <Row label="Room"   value={roomInfo?.name || (roomId ? "Loading…" : "Not selected")} />
          <Row label="Date"   value={date ? formatDate(date) : "Not selected"} />
          <Row label="Time"   value={startTime && endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : "Not selected"} />
          <Row label="Title"  value={title.trim() || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Not entered</span>} />
          {!isStudent && <Row label="Type" value={BOOKING_TYPE_OPTIONS.find((o) => o.value === bookingType)?.label || bookingType} />}
        </div>

        {/* Global submit error */}
        {submitError && (
          <div
            className="rounded-lg px-4 py-3"
            style={{ background: "rgba(232,68,90,0.08)", border: "1px solid rgba(232,68,90,0.25)" }}
          >
            <p style={{ fontSize: 13, color: "var(--danger)" }}>{submitError}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            background: submitting ? "var(--border)" : "var(--accent)",
            color: submitting ? "var(--text-muted)" : "#000",
            border: "none",
            borderRadius: 10,
            padding: "13px 0",
            fontSize: 15,
            fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            width: "100%",
            transition: "opacity 150ms, background 150ms",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.opacity = "0.88"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          {submitting && (
            <span
              style={{
                width: 16,
                height: 16,
                border: "2px solid rgba(0,0,0,0.3)",
                borderTopColor: "#000",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
              }}
            />
          )}
          {submitting ? "Confirming…" : "Confirm Booking"}
        </button>
      </Section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
