import { useEffect, useState, useCallback } from "react";
import { api } from "../../api/client";
import { useWebSocket } from "../../context/WebSocketContext";

const TABS = ["Cameras", "Access Events", "Access Rules"];

function roleColor(role) {
  if (role === "admin") return { background: "rgba(139,92,246,0.15)", color: "#8b5cf6" };
  if (role === "staff") return { background: "rgba(59,130,246,0.15)", color: "#3b82f6" };
  return { background: "rgba(16,185,129,0.15)", color: "var(--success)" };
}

// Cameras Tab

function CamerasTab() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    room_id: "",
    rtsp_url: "",
    crossing_line_y: 0.5,
    entry_direction: "up",
  });

  const fetchCameras = useCallback(async () => {
    try {
      const data = await api.getCameras();
      setCameras(Array.isArray(data) ? data : data.cameras || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const resetForm = () => {
    setForm({ name: "", room_id: "", rtsp_url: "", crossing_line_y: 0.5, entry_direction: "up" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateCamera(editingId, {
          name: form.name,
          rtsp_url: form.rtsp_url,
          crossing_line_y: parseFloat(form.crossing_line_y),
          entry_direction: form.entry_direction,
        });
      } else {
        await api.createCamera({
          name: form.name,
          room_id: parseInt(form.room_id, 10),
          rtsp_url: form.rtsp_url,
          crossing_line_y: parseFloat(form.crossing_line_y),
          entry_direction: form.entry_direction,
        });
      }
      resetForm();
      fetchCameras();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (cam) => {
    setForm({
      name: cam.name,
      room_id: String(cam.room_id),
      rtsp_url: cam.rtsp_url || "",
      crossing_line_y: cam.crossing_line_y ?? 0.5,
      entry_direction: cam.entry_direction || "up",
    });
    setEditingId(cam.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this camera?")) return;
    try {
      await api.deleteCamera(id);
      fetchCameras();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p className="admin-loading">Loading cameras...</p>;

  return (
    <div>
      {error && <p className="alert-danger">{error}</p>}

      <div className="admin-page-header">
        <span className="admin-card-meta">{cameras.length} camera{cameras.length !== 1 ? "s" : ""}</span>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? "Cancel" : "+ Add Camera"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="admin-card">
          <div className="admin-card-body">
            <p className="admin-card-title">{editingId ? "Edit Camera" : "Add Camera"}</p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Main Entrance Cam"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Room ID</label>
                <input
                  className="form-input"
                  value={form.room_id}
                  onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                  placeholder="1"
                  required={!editingId}
                  disabled={!!editingId}
                />
              </div>
              <div className="form-group">
                <label className="form-label">RTSP URL</label>
                <input
                  className="form-input"
                  value={form.rtsp_url}
                  onChange={(e) => setForm({ ...form, rtsp_url: e.target.value })}
                  placeholder="rtsp://192.168.1.100:554/stream"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Crossing Line Y ({Number(form.crossing_line_y).toFixed(2)})</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.crossing_line_y}
                  onChange={(e) => setForm({ ...form, crossing_line_y: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Entry Direction</label>
                <select
                  className="form-select"
                  value={form.entry_direction}
                  onChange={(e) => setForm({ ...form, entry_direction: e.target.value })}
                >
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              {editingId ? "Update Camera" : "Create Camera"}
            </button>
          </div>
        </form>
      )}

      {cameras.map((cam) => (
        <div key={cam.id} className="admin-card">
          <div className="admin-card-header">
            <div>
              <div className="admin-card-title">
                {cam.name}
                <span
                  className="status-badge"
                  style={{
                    background: cam.status === "online" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                    color: cam.status === "online" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {cam.status || "offline"}
                </span>
              </div>
              <div className="admin-card-meta">
                {cam.building_name && <span>{cam.building_name} </span>}
                {cam.room_name && <span>Room: {cam.room_name} </span>}
                <span>Direction: {cam.entry_direction || "N/A"} </span>
                <span>Line Y: {cam.crossing_line_y ?? "N/A"}</span>
              </div>
              {cam.installed_at && (
                <div className="admin-card-meta">
                  Installed: {new Date(cam.installed_at).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="admin-page-controls">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(cam)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cam.id)}>Delete</button>
            </div>
          </div>
        </div>
      ))}

      {cameras.length === 0 && (
        <div className="empty-state">
          <p>No cameras found. Add one to get started.</p>
        </div>
      )}
    </div>
  );
}

// Access Events Tab

function AccessEventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ws = useWebSocket();

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.getCameraEvents("all", { limit: 100 });
      setEvents(Array.isArray(data) ? data : data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // WebSocket real-time events
  useEffect(() => {
    if (!ws) return;
    const handleEvent = (data) => {
      if (data && data.id) {
        setEvents((prev) => [data, ...prev].slice(0, 200));
      }
    };
    ws.on("access_event", handleEvent);
    ws.on("camera_event", handleEvent);
    return () => {
      ws.off("access_event", handleEvent);
      ws.off("camera_event", handleEvent);
    };
  }, [ws]);

  if (loading) return <p className="admin-loading">Loading events...</p>;

  return (
    <div>
      {error && <p className="alert-danger">{error}</p>}
      <div className="admin-page-header">
        <span className="admin-card-meta">{events.length} event{events.length !== 1 ? "s" : ""} (auto-refreshing)</span>
        <button className="btn btn-secondary" onClick={fetchEvents}>Refresh Now</button>
      </div>

      <div className="admin-card">
        <div className="admin-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Camera</th>
                <th>User</th>
                <th>Direction</th>
                <th>Authorized</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id}>
                  <td>{evt.timestamp ? new Date(evt.timestamp).toLocaleString() : "—"}</td>
                  <td>{evt.camera_id ?? "—"}</td>
                  <td>{evt.user_name || evt.user_id || "Unknown"}</td>
                  <td>
                    <span style={{
                      fontWeight: 600,
                      color: evt.direction === "entry" ? "var(--success)" : "#f97316",
                    }}>
                      {evt.direction === "entry" ? "\u2191 Entry" : "\u2193 Exit"}
                    </span>
                  </td>
                  <td>
                    {evt.authorized ? (
                      <span style={{ color: "var(--success)", fontWeight: 700 }}>{"\u2713"}</span>
                    ) : (
                      <span style={{ color: "var(--danger)", fontWeight: 700 }}>{"\u2717"}</span>
                    )}
                  </td>
                  <td>{evt.confidence != null ? `${(evt.confidence * 100).toFixed(0)}%` : "—"}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No access events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Access Rules Tab

function AccessRulesTab() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    role: "student",
    building_id: "",
    room_id: "",
    day_of_week: "",
    start_hour: "",
    end_hour: "",
  });

  const fetchRules = useCallback(async () => {
    try {
      const data = await api.getAccessRules({});
      setRules(Array.isArray(data) ? data : data.rules || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const resetForm = () => {
    setForm({ role: "student", building_id: "", room_id: "", day_of_week: "", start_hour: "", end_hour: "" });
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createAccessRule({
        role: form.role,
        building_id: form.building_id ? parseInt(form.building_id, 10) : undefined,
        room_id: form.room_id ? parseInt(form.room_id, 10) : undefined,
        day_of_week: form.day_of_week ? parseInt(form.day_of_week, 10) : undefined,
        start_hour: form.start_hour !== "" ? parseInt(form.start_hour, 10) : undefined,
        end_hour: form.end_hour !== "" ? parseInt(form.end_hour, 10) : undefined,
      });
      resetForm();
      fetchRules();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this access rule?")) return;
    try {
      await api.deleteAccessRule(id);
      fetchRules();
    } catch (err) {
      setError(err.message);
    }
  };

  const dayName = (d) => {
    if (d == null) return "Any";
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[d] || String(d);
  };

  const hourLabel = (h) => {
    if (h == null) return "*";
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
  };

  if (loading) return <p className="admin-loading">Loading rules...</p>;

  return (
    <div>
      {error && <p className="alert-danger">{error}</p>}

      <div className="admin-page-header">
        <span className="admin-card-meta">{rules.length} rule{rules.length !== 1 ? "s" : ""}</span>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? "Cancel" : "+ Add Rule"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="admin-card">
          <div className="admin-card-body">
            <p className="admin-card-title">Add Access Rule</p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="student">Student</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Building ID</label>
                <input
                  className="form-input"
                  value={form.building_id}
                  onChange={(e) => setForm({ ...form, building_id: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Room ID</label>
                <input
                  className="form-input"
                  value={form.room_id}
                  onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Day of Week (0=Sun .. 6=Sat)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="6"
                  value={form.day_of_week}
                  onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
                  placeholder="Any"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Start Hour (0-23)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="23"
                  value={form.start_hour}
                  onChange={(e) => setForm({ ...form, start_hour: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Hour (0-23)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="23"
                  value={form.end_hour}
                  onChange={(e) => setForm({ ...form, end_hour: e.target.value })}
                  placeholder="23"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Create Rule</button>
          </div>
        </form>
      )}

      <div className="admin-card">
        <div className="admin-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Building</th>
                <th>Room</th>
                <th>Day</th>
                <th>Hours</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <span className="pill" style={roleColor(rule.role)}>
                      {rule.role}
                    </span>
                  </td>
                  <td>{rule.building_id ?? "Any"}</td>
                  <td>{rule.room_id ?? "Any"}</td>
                  <td>{dayName(rule.day_of_week)}</td>
                  <td>
                    {rule.start_hour != null && rule.end_hour != null
                      ? `${hourLabel(rule.start_hour)} - ${hourLabel(rule.end_hour)}`
                      : "All day"}
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rule.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No access rules defined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Main Page

export default function Cameras() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Camera Management</h1>

      <div className="tab-bar">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === i ? "active" : ""}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && <CamerasTab />}
      {activeTab === 1 && <AccessEventsTab />}
      {activeTab === 2 && <AccessRulesTab />}
    </div>
  );
}
