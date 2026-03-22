import { useEffect, useState } from "react";
import { api } from "../../api/client";

// ─── Constants ──────────────────────────────────────────────────────────────
const ROOM_TYPES = [
  "classroom",
  "lecture_hall",
  "computer_lab",
  "science_lab",
  "study_room",
  "conference_room",
  "event_space",
  "multipurpose",
];

const EQUIPMENT_OPTIONS = [
  "projector",
  "whiteboard",
  "video_conferencing",
  "smart_board",
  "computers",
  "lab_equipment",
  "power_outlets",
  "recording_studio",
];

const label = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ─── Shared Styles ──────────────────────────────────────────────────────────
const S = {
  page: { padding: "2rem", maxWidth: 1100, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  title: { fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" },
  card: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.25rem",
    cursor: "pointer",
    userSelect: "none",
  },
  cardTitle: { fontWeight: 600, color: "var(--text-primary)", fontSize: "1.05rem" },
  cardMeta: { color: "var(--text-muted)", fontSize: "0.82rem", marginTop: 2 },
  section: {
    padding: "0 1.25rem 1.25rem",
    borderTop: "1px solid var(--border)",
  },
  sectionTitle: {
    fontWeight: 600,
    color: "var(--text-primary)",
    fontSize: "0.95rem",
    margin: "1rem 0 0.5rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floorCard: {
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    marginBottom: 8,
  },
  roomRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.4rem 0",
    borderBottom: "1px solid var(--border)",
    fontSize: "0.88rem",
  },
  btn: {
    padding: "6px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.82rem",
  },
  btnPrimary: {
    background: "var(--accent)",
    color: "#fff",
  },
  btnDanger: {
    background: "transparent",
    color: "var(--danger)",
    border: "1px solid var(--danger)",
  },
  btnGhost: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
  },
  formRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  input: {
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontSize: "0.85rem",
    outline: "none",
  },
  select: {
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
    fontSize: "0.85rem",
    outline: "none",
  },
  error: {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid var(--danger)",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    color: "var(--danger)",
    marginBottom: 16,
    fontSize: "0.88rem",
  },
  loading: {
    textAlign: "center",
    color: "var(--text-muted)",
    padding: "3rem 0",
    fontSize: "1rem",
  },
  equipLabel: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    color: "var(--text-muted)",
    fontSize: "0.82rem",
    cursor: "pointer",
  },
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: "0.75rem",
    fontWeight: 600,
    background: "var(--border)",
    color: "var(--text-muted)",
    marginRight: 4,
  },
};

// ─── Inline Form Components ─────────────────────────────────────────────────

function BuildingForm({ initial, onSave, onCancel, saving }) {
  const [f, setF] = useState(
    initial || { name: "", code: "", address: "", total_floors: 1 }
  );
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ ...S.card, padding: "1rem 1.25rem" }}>
      <div style={S.formRow}>
        <input
          style={{ ...S.input, flex: 2, minWidth: 140 }}
          placeholder="Building name"
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <input
          style={{ ...S.input, flex: 1, minWidth: 80 }}
          placeholder="Code (e.g. SHU)"
          value={f.code}
          onChange={(e) => set("code", e.target.value)}
        />
        <input
          style={{ ...S.input, flex: 2, minWidth: 140 }}
          placeholder="Address"
          value={f.address}
          onChange={(e) => set("address", e.target.value)}
        />
        {!initial && (
          <input
            style={{ ...S.input, width: 80 }}
            placeholder="Floors"
            type="number"
            min={1}
            value={f.total_floors}
            onChange={(e) => set("total_floors", Number(e.target.value))}
          />
        )}
        <button
          style={{ ...S.btn, ...S.btnPrimary }}
          disabled={saving || !f.name.trim() || !f.code.trim()}
          onClick={() => onSave(f)}
        >
          {saving ? "Saving..." : initial ? "Update" : "Add Building"}
        </button>
        <button style={{ ...S.btn, ...S.btnGhost }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function FloorForm({ onSave, onCancel, saving }) {
  const [f, setF] = useState({ floor_number: 1, name: "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div style={S.formRow}>
      <input
        style={{ ...S.input, width: 80 }}
        placeholder="Floor #"
        type="number"
        min={0}
        value={f.floor_number}
        onChange={(e) => set("floor_number", Number(e.target.value))}
      />
      <input
        style={{ ...S.input, flex: 1, minWidth: 120 }}
        placeholder="Floor name (e.g. Ground Floor)"
        value={f.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <button
        style={{ ...S.btn, ...S.btnPrimary }}
        disabled={saving || !f.name.trim()}
        onClick={() => onSave(f)}
      >
        {saving ? "Saving..." : "Add Floor"}
      </button>
      <button style={{ ...S.btn, ...S.btnGhost }} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function RoomForm({ floorId, initial, onSave, onCancel, saving }) {
  const [f, setF] = useState(
    initial || {
      floor_id: floorId,
      name: "",
      room_type: "classroom",
      capacity: 30,
      hourly_rate: 0,
      is_bookable: true,
      description: "",
      equipment: [],
    }
  );
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const toggleEquip = (item) =>
    setF((p) => ({
      ...p,
      equipment: p.equipment.includes(item)
        ? p.equipment.filter((e) => e !== item)
        : [...p.equipment, item],
    }));

  return (
    <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: 8, border: "1px solid var(--border)" }}>
      <div style={S.formRow}>
        <input
          style={{ ...S.input, flex: 2, minWidth: 120 }}
          placeholder="Room name"
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <select
          style={{ ...S.select, flex: 1, minWidth: 130 }}
          value={f.room_type}
          onChange={(e) => set("room_type", e.target.value)}
        >
          {ROOM_TYPES.map((t) => (
            <option key={t} value={t}>{label(t)}</option>
          ))}
        </select>
        <input
          style={{ ...S.input, width: 80 }}
          placeholder="Capacity"
          type="number"
          min={1}
          value={f.capacity}
          onChange={(e) => set("capacity", Number(e.target.value))}
        />
        <input
          style={{ ...S.input, width: 100 }}
          placeholder="$/hr"
          type="number"
          min={0}
          step={0.5}
          value={f.hourly_rate}
          onChange={(e) => set("hourly_rate", Number(e.target.value))}
        />
      </div>
      <div style={S.formRow}>
        <input
          style={{ ...S.input, flex: 1 }}
          placeholder="Description (optional)"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        {EQUIPMENT_OPTIONS.map((eq) => (
          <label key={eq} style={S.equipLabel}>
            <input
              type="checkbox"
              checked={f.equipment.includes(eq)}
              onChange={() => toggleEquip(eq)}
            />
            {label(eq)}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{ ...S.btn, ...S.btnPrimary }}
          disabled={saving || !f.name.trim()}
          onClick={() => onSave({ ...f, floor_id: floorId })}
        >
          {saving ? "Saving..." : initial ? "Update Room" : "Add Room"}
        </button>
        <button style={{ ...S.btn, ...S.btnGhost }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ManageSpaces() {
  const [buildings, setBuildings] = useState([]);
  const [expanded, setExpanded] = useState({});     // buildingId -> { floors, rooms }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Which inline form is open: { type: "building" | "floor" | "room" | "editBuilding" | "editRoom", id? }
  const [formOpen, setFormOpen] = useState(null);

  // ── Fetch buildings ─────────────────────────────────────────────────────
  const fetchBuildings = async () => {
    try {
      const data = await api.getBuildings();
      const list = Array.isArray(data) ? data : data.buildings || [];
      setBuildings(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildings();
  }, []);

  // ── Expand / collapse building ──────────────────────────────────────────
  const toggleExpand = async (buildingId) => {
    if (expanded[buildingId]) {
      setExpanded((p) => {
        const next = { ...p };
        delete next[buildingId];
        return next;
      });
      return;
    }
    try {
      const [detail, roomsData] = await Promise.all([
        api.getBuilding(buildingId),
        api.getRooms({ building_id: buildingId }),
      ]);
      const floors = detail.floors || [];
      const rooms = roomsData.items || roomsData || [];
      setExpanded((p) => ({ ...p, [buildingId]: { floors, rooms } }));
    } catch (err) {
      setError(`Failed to load building details: ${err.message}`);
    }
  };

  // ── CRUD helpers ────────────────────────────────────────────────────────
  const handleCreateBuilding = async (form) => {
    setSaving(true);
    try {
      await api.createBuilding(form);
      setFormOpen(null);
      await fetchBuildings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBuilding = async (form) => {
    setSaving(true);
    try {
      await api.updateBuilding(form.id, { name: form.name, code: form.code, address: form.address });
      setFormOpen(null);
      await fetchBuildings();
      // refresh expanded if open
      if (expanded[form.id]) {
        const next = { ...expanded };
        delete next[form.id];
        setExpanded(next);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBuilding = async (id) => {
    if (!window.confirm("Delete this building and all its floors/rooms?")) return;
    setSaving(true);
    try {
      await api.deleteBuilding(id);
      setExpanded((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      await fetchBuildings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFloor = async (buildingId, form) => {
    setSaving(true);
    try {
      await api.createFloor(buildingId, form);
      setFormOpen(null);
      // refresh expanded
      const next = { ...expanded };
      delete next[buildingId];
      setExpanded(next);
      await toggleExpand(buildingId);
      await fetchBuildings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFloor = async (floorId, buildingId) => {
    if (!window.confirm("Delete this floor and all its rooms?")) return;
    setSaving(true);
    try {
      await api.deleteFloor(floorId);
      const next = { ...expanded };
      delete next[buildingId];
      setExpanded(next);
      await toggleExpand(buildingId);
      await fetchBuildings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRoom = async (form) => {
    setSaving(true);
    try {
      await api.createRoom(form);
      setFormOpen(null);
      // find building for this floor and refresh
      for (const [bid, data] of Object.entries(expanded)) {
        if (data.floors.some((f) => f.id === form.floor_id)) {
          const next = { ...expanded };
          delete next[bid];
          setExpanded(next);
          await toggleExpand(Number(bid));
          break;
        }
      }
      await fetchBuildings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoom = async (form) => {
    setSaving(true);
    try {
      await api.updateRoom(form.id, form);
      setFormOpen(null);
      // refresh all expanded buildings
      const ids = Object.keys(expanded).map(Number);
      setExpanded({});
      for (const id of ids) await toggleExpand(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm("Delete this room?")) return;
    setSaving(true);
    try {
      await api.deleteRoom(roomId);
      const ids = Object.keys(expanded).map(Number);
      setExpanded({});
      for (const id of ids) await toggleExpand(id);
      await fetchBuildings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) return <div style={S.loading}>Loading spaces...</div>;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>Manage Spaces</h1>
        <button
          style={{ ...S.btn, ...S.btnPrimary }}
          onClick={() => setFormOpen({ type: "building" })}
        >
          + Add Building
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={S.error}>
          <span>{error}</span>
          <button
            style={{ ...S.btn, ...S.btnGhost, marginLeft: 12, padding: "2px 10px" }}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New building form */}
      {formOpen?.type === "building" && (
        <BuildingForm
          onSave={handleCreateBuilding}
          onCancel={() => setFormOpen(null)}
          saving={saving}
        />
      )}

      {/* Building list */}
      {buildings.length === 0 && !formOpen && (
        <div style={S.loading}>No buildings yet. Add one to get started.</div>
      )}

      {buildings.map((b) => {
        const isExpanded = !!expanded[b.id];
        const detail = expanded[b.id];

        return (
          <div key={b.id} style={S.card}>
            {/* Building header */}
            <div style={S.cardHeader} onClick={() => toggleExpand(b.id)}>
              <div>
                <div style={S.cardTitle}>
                  {isExpanded ? "\u25BC" : "\u25B6"} {b.name}
                  <span style={{ ...S.badge, marginLeft: 8 }}>{b.code}</span>
                </div>
                <div style={S.cardMeta}>
                  {b.address || "No address"} &middot; {b.total_floors ?? "?"} floor(s) &middot; {b.room_count ?? 0} room(s)
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                <button
                  style={{ ...S.btn, ...S.btnGhost }}
                  onClick={() =>
                    setFormOpen({ type: "editBuilding", data: { id: b.id, name: b.name, code: b.code, address: b.address || "" } })
                  }
                >
                  Edit
                </button>
                <button
                  style={{ ...S.btn, ...S.btnDanger }}
                  onClick={() => handleDeleteBuilding(b.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Edit building form */}
            {formOpen?.type === "editBuilding" && formOpen.data?.id === b.id && (
              <div style={{ padding: "0 1.25rem 1rem" }}>
                <BuildingForm
                  initial={formOpen.data}
                  onSave={(f) => handleUpdateBuilding({ ...f, id: b.id })}
                  onCancel={() => setFormOpen(null)}
                  saving={saving}
                />
              </div>
            )}

            {/* Expanded content */}
            {isExpanded && detail && (
              <div style={S.section}>
                <div style={S.sectionTitle}>
                  <span>Floors</span>
                  <button
                    style={{ ...S.btn, ...S.btnPrimary, fontSize: "0.78rem", padding: "4px 10px" }}
                    onClick={() => setFormOpen({ type: "floor", buildingId: b.id })}
                  >
                    + Add Floor
                  </button>
                </div>

                {/* New floor form */}
                {formOpen?.type === "floor" && formOpen.buildingId === b.id && (
                  <FloorForm
                    onSave={(f) => handleCreateFloor(b.id, f)}
                    onCancel={() => setFormOpen(null)}
                    saving={saving}
                  />
                )}

                {detail.floors.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "0.5rem 0" }}>
                    No floors yet.
                  </div>
                )}

                {detail.floors
                  .sort((a, b2) => a.floor_number - b2.floor_number)
                  .map((floor) => {
                    const floorRooms = detail.rooms.filter(
                      (r) =>
                        r.floor_id === floor.id ||
                        r.floor_name === floor.name
                    );

                    return (
                      <div key={floor.id} style={S.floorCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                            Floor {floor.floor_number} &mdash; {floor.name}
                            <span style={{ ...S.badge, marginLeft: 8 }}>{floorRooms.length} room(s)</span>
                          </span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              style={{ ...S.btn, ...S.btnPrimary, fontSize: "0.75rem", padding: "3px 8px" }}
                              onClick={() => setFormOpen({ type: "room", floorId: floor.id, buildingId: b.id })}
                            >
                              + Room
                            </button>
                            <button
                              style={{ ...S.btn, ...S.btnDanger, fontSize: "0.75rem", padding: "3px 8px" }}
                              onClick={() => handleDeleteFloor(floor.id, b.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* New room form */}
                        {formOpen?.type === "room" && formOpen.floorId === floor.id && (
                          <RoomForm
                            floorId={floor.id}
                            onSave={handleCreateRoom}
                            onCancel={() => setFormOpen(null)}
                            saving={saving}
                          />
                        )}

                        {/* Room list */}
                        {floorRooms.map((room) => (
                          <div key={room.id}>
                            {formOpen?.type === "editRoom" && formOpen.data?.id === room.id ? (
                              <RoomForm
                                floorId={floor.id}
                                initial={{
                                  ...room,
                                  equipment: Array.isArray(room.equipment)
                                    ? room.equipment
                                    : typeof room.equipment === "string"
                                    ? room.equipment.split(",").map((s) => s.trim()).filter(Boolean)
                                    : [],
                                }}
                                onSave={(f) => handleUpdateRoom({ ...f, id: room.id })}
                                onCancel={() => setFormOpen(null)}
                                saving={saving}
                              />
                            ) : (
                              <div style={S.roomRow}>
                                <div>
                                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{room.name}</span>
                                  <span style={{ ...S.badge, marginLeft: 6 }}>{label(room.room_type || "unknown")}</span>
                                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: 6 }}>
                                    Cap: {room.capacity} &middot; ${room.hourly_rate ?? 0}/hr
                                  </span>
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    style={{ ...S.btn, ...S.btnGhost, fontSize: "0.75rem", padding: "2px 8px" }}
                                    onClick={() =>
                                      setFormOpen({ type: "editRoom", data: room })
                                    }
                                  >
                                    Edit
                                  </button>
                                  <button
                                    style={{ ...S.btn, ...S.btnDanger, fontSize: "0.75rem", padding: "2px 8px" }}
                                    onClick={() => handleDeleteRoom(room.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {floorRooms.length === 0 && formOpen?.floorId !== floor.id && (
                          <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", padding: "0.25rem 0" }}>
                            No rooms on this floor.
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
