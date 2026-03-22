import { useEffect, useState, useCallback } from "react";
import { api } from "../../api/client";
import { useWebSocket } from "../../context/WebSocketContext";

const TABS = ["Cameras", "Access Events", "Access Rules"];

const styles = {
  page: {
    padding: "1.5rem",
    maxWidth: 1200,
    margin: "0 auto",
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "1.25rem",
  },
  tabBar: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid var(--border)",
    marginBottom: "1.5rem",
  },
  tab: (active) => ({
    padding: "0.6rem 1.25rem",
    fontSize: 13,
    fontWeight: 600,
    color: active ? "var(--accent)" : "var(--text-muted)",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
  }),
  card: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1rem 1.25rem",
    marginBottom: "0.75rem",
  },
  badge: (online) => ({
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "2px 8px",
    borderRadius: 999,
    background: online ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
    color: online ? "var(--success)" : "var(--danger)",
  }),
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border)",
  },
  td: {
    padding: "0.5rem 0.75rem",
    color: "var(--text-primary)",
    borderBottom: "1px solid var(--border)",
  },
  formWrap: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1.25rem",
    marginBottom: "1.25rem",
  },
  formTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text-primary)",
    marginBottom: "0.75rem",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "0.75rem",
    marginBottom: "0.75rem",
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
  },
  input: {
    width: "100%",
    padding: "0.4rem 0.6rem",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "0.4rem 0.6rem",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    outline: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    padding: "0.45rem 1rem",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    cursor: "pointer",
  },
  btnDanger: {
    padding: "0.35rem 0.75rem",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    background: "var(--danger)",
    color: "#fff",
    cursor: "pointer",
  },
  btnGhost: {
    padding: "0.35rem 0.75rem",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "none",
    color: "var(--text-primary)",
    cursor: "pointer",
  },
  error: {
    color: "var(--danger)",
    fontSize: 13,
    marginBottom: "0.75rem",
  },
  muted: {
    fontSize: 11,
    color: "var(--text-muted)",
  },
};

// ─── Cameras Tab ────────────────────────────────────────────────────────────

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

  if (loading) return <p style={styles.muted}>Loading cameras...</p>;

  return (
    <div>
      {error && <p style={styles.error}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{cameras.length} camera{cameras.length !== 1 ? "s" : ""}</span>
        <button style={styles.btnPrimary} onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? "Cancel" : "+ Add Camera"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.formWrap}>
          <p style={styles.formTitle}>{editingId ? "Edit Camera" : "Add Camera"}</p>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Main Entrance Cam"
                required
              />
            </div>
            <div>
              <label style={styles.label}>Room ID</label>
              <input
                style={styles.input}
                value={form.room_id}
                onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                placeholder="1"
                required={!editingId}
                disabled={!!editingId}
              />
            </div>
            <div>
              <label style={styles.label}>RTSP URL</label>
              <input
                style={styles.input}
                value={form.rtsp_url}
                onChange={(e) => setForm({ ...form, rtsp_url: e.target.value })}
                placeholder="rtsp://192.168.1.100:554/stream"
              />
            </div>
            <div>
              <label style={styles.label}>Crossing Line Y ({Number(form.crossing_line_y).toFixed(2)})</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={form.crossing_line_y}
                onChange={(e) => setForm({ ...form, crossing_line_y: e.target.value })}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
            </div>
            <div>
              <label style={styles.label}>Entry Direction</label>
              <select
                style={styles.select}
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
          <button type="submit" style={styles.btnPrimary}>
            {editingId ? "Update Camera" : "Create Camera"}
          </button>
        </form>
      )}

      {cameras.map((cam) => (
        <div key={cam.id} style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{cam.name}</span>
                <span style={styles.badge(cam.status === "online")}>
                  {cam.status || "offline"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", ...styles.muted }}>
                {cam.building_name && <span>{cam.building_name}</span>}
                {cam.room_name && <span>Room: {cam.room_name}</span>}
                <span>Direction: {cam.entry_direction || "N/A"}</span>
                <span>Line Y: {cam.crossing_line_y ?? "N/A"}</span>
              </div>
              {cam.installed_at && (
                <div style={{ ...styles.muted, marginTop: 2 }}>
                  Installed: {new Date(cam.installed_at).toLocaleDateString()}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button style={styles.btnGhost} onClick={() => handleEdit(cam)}>Edit</button>
              <button style={styles.btnDanger} onClick={() => handleDelete(cam.id)}>Delete</button>
            </div>
          </div>
        </div>
      ))}

      {cameras.length === 0 && (
        <p style={{ ...styles.muted, textAlign: "center", padding: "2rem 0" }}>
          No cameras found. Add one to get started.
        </p>
      )}
    </div>
  );
}

// ─── Access Events Tab ──────────────────────────────────────────────────────

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

  if (loading) return <p style={styles.muted}>Loading events...</p>;

  return (
    <div>
      {error && <p style={styles.error}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <span style={styles.muted}>{events.length} event{events.length !== 1 ? "s" : ""} (auto-refreshing)</span>
        <button style={styles.btnGhost} onClick={fetchEvents}>Refresh Now</button>
      </div>

      <div style={{ overflowX: "auto", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12 }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Timestamp</th>
              <th style={styles.th}>Camera</th>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Direction</th>
              <th style={styles.th}>Authorized</th>
              <th style={styles.th}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {events.map((evt) => (
              <tr key={evt.id}>
                <td style={styles.td}>
                  {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : "—"}
                </td>
                <td style={styles.td}>{evt.camera_id ?? "—"}</td>
                <td style={styles.td}>{evt.user_name || evt.user_id || "Unknown"}</td>
                <td style={styles.td}>
                  <span style={{
                    fontWeight: 600,
                    color: evt.direction === "entry" ? "var(--success)" : "#f97316",
                  }}>
                    {evt.direction === "entry" ? "\u2191 Entry" : "\u2193 Exit"}
                  </span>
                </td>
                <td style={styles.td}>
                  {evt.authorized ? (
                    <span style={{ color: "var(--success)", fontWeight: 700 }}>{"\u2713"}</span>
                  ) : (
                    <span style={{ color: "var(--danger)", fontWeight: 700 }}>{"\u2717"}</span>
                  )}
                </td>
                <td style={styles.td}>
                  {evt.confidence != null ? `${(evt.confidence * 100).toFixed(0)}%` : "—"}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...styles.td, textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                  No access events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Access Rules Tab ───────────────────────────────────────────────────────

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

  if (loading) return <p style={styles.muted}>Loading rules...</p>;

  return (
    <div>
      {error && <p style={styles.error}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <span style={styles.muted}>{rules.length} rule{rules.length !== 1 ? "s" : ""}</span>
        <button style={styles.btnPrimary} onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? "Cancel" : "+ Add Rule"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.formWrap}>
          <p style={styles.formTitle}>Add Access Rule</p>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>Role</label>
              <select
                style={styles.select}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Building ID</label>
              <input
                style={styles.input}
                value={form.building_id}
                onChange={(e) => setForm({ ...form, building_id: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label style={styles.label}>Room ID</label>
              <input
                style={styles.input}
                value={form.room_id}
                onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label style={styles.label}>Day of Week (0=Sun .. 6=Sat)</label>
              <input
                style={styles.input}
                type="number"
                min="0"
                max="6"
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
                placeholder="Any"
              />
            </div>
            <div>
              <label style={styles.label}>Start Hour (0-23)</label>
              <input
                style={styles.input}
                type="number"
                min="0"
                max="23"
                value={form.start_hour}
                onChange={(e) => setForm({ ...form, start_hour: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <label style={styles.label}>End Hour (0-23)</label>
              <input
                style={styles.input}
                type="number"
                min="0"
                max="23"
                value={form.end_hour}
                onChange={(e) => setForm({ ...form, end_hour: e.target.value })}
                placeholder="23"
              />
            </div>
          </div>
          <button type="submit" style={styles.btnPrimary}>Create Rule</button>
        </form>
      )}

      <div style={{ overflowX: "auto", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12 }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Building</th>
              <th style={styles.th}>Room</th>
              <th style={styles.th}>Day</th>
              <th style={styles.th}>Hours</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td style={styles.td}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: rule.role === "admin" ? "rgba(139,92,246,0.15)" : rule.role === "staff" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)",
                      color: rule.role === "admin" ? "#8b5cf6" : rule.role === "staff" ? "#3b82f6" : "var(--success)",
                    }}
                  >
                    {rule.role}
                  </span>
                </td>
                <td style={styles.td}>{rule.building_id ?? "Any"}</td>
                <td style={styles.td}>{rule.room_id ?? "Any"}</td>
                <td style={styles.td}>{dayName(rule.day_of_week)}</td>
                <td style={styles.td}>
                  {rule.start_hour != null && rule.end_hour != null
                    ? `${hourLabel(rule.start_hour)} - ${hourLabel(rule.end_hour)}`
                    : "All day"}
                </td>
                <td style={styles.td}>
                  <button style={styles.btnDanger} onClick={() => handleDelete(rule.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...styles.td, textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                  No access rules defined yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function Cameras() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Camera Management</h1>

      <div style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <button key={tab} style={styles.tab(activeTab === i)} onClick={() => setActiveTab(i)}>
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
