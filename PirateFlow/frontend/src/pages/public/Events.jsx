import { useState, useEffect } from "react";
import { api } from "../../api/client";

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventCard({ event }) {
  const hasImage = !!event.image_url;

  return (
    <div className="event-card">
      {hasImage && (
        <img
          src={event.image_url}
          alt={event.name}
          className="event-card-img"
        />
      )}
      <div className="event-card-body">
        <div className="event-card-date">
          {formatDate(event.starts_at)}
          {event.ends_at && ` · ${formatTime(event.starts_at)} – ${formatTime(event.ends_at)}`}
          {!event.ends_at && ` · ${formatTime(event.starts_at)}`}
        </div>
        <h3 className="event-card-name">{event.name}</h3>
        {event.organization && (
          <p className="event-card-org">{event.organization}</p>
        )}
        {event.location && (
          <p className="event-card-location">{event.location}</p>
        )}
        {event.description && (
          <p className="event-card-desc">{event.description}</p>
        )}
        {event.category_names && (
          <div className="event-card-tags">
            {event.category_names.split(",").map((cat) => (
              <span key={cat.trim()} className="event-card-tag">
                {cat.trim()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = {};
    if (dateFilter) params.date = dateFilter;
    else params.limit = 50;

    api.getEvents(params)
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load events."))
      .finally(() => setLoading(false));
  }, [dateFilter]);

  return (
    <div className="events-page">
      <div className="events-header">
        <div>
          <h1>Campus Events</h1>
          <p className="events-subtitle">Upcoming events at Seton Hall University</p>
        </div>
        <div className="events-filter">
          <label className="form-label" htmlFor="event-date">Filter by date</label>
          <input
            id="event-date"
            type="date"
            className="form-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {dateFilter && (
            <button className="btn btn-secondary btn-sm" onClick={() => setDateFilter("")}>
              Clear
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="events-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ height: 200 }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <h3>No events found</h3>
          <p>{dateFilter ? "No events on this date." : "No upcoming events right now."}</p>
          {dateFilter && (
            <button className="btn btn-primary" onClick={() => setDateFilter("")}>
              Show all events
            </button>
          )}
        </div>
      ) : (
        <div className="events-grid">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
