import { useEffect, useState } from "react";
import { api } from "../../api/client";

// Constants
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

// Inline Form Components

function BuildingForm({ initial, onSave, onCancel, saving }) {
  const [f, setF] = useState(
    initial || { name: "", code: "", address: "", total_floors: 1 }
  );
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="admin-card">
      <div className="admin-form-row">
        <label className="admin-field-label">
          Building Name
          <input
            className="admin-input"
            placeholder="e.g. Jubilee Hall"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="admin-field-label">
          Code
          <input
            className="admin-input"
            placeholder="e.g. JUB"
            value={f.code}
            onChange={(e) => set("code", e.target.value)}
          />
        </label>
        <label className="admin-field-label">
          Address
          <input
            className="admin-input"
            placeholder="e.g. 400 South Orange Ave"
            value={f.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </label>
        {!initial && (
          <label className="admin-field-label">
            Floors
            <input
              className="admin-input"
              placeholder="1"
              type="number"
              min={1}
              value={f.total_floors}
              onChange={(e) => set("total_floors", Number(e.target.value))}
            />
          </label>
        )}
        <button
          className="btn btn-primary btn-sm"
          disabled={saving || !f.name.trim() || !f.code.trim()}
          onClick={() => onSave(f)}
        >
          {saving ? "Saving..." : initial ? "Update" : "Add Building"}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
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
    <div className="admin-form-row">
      <label className="admin-field-label">
        Floor #
        <input
          className="admin-input"
          placeholder="1"
          type="number"
          min={0}
          value={f.floor_number}
          onChange={(e) => set("floor_number", Number(e.target.value))}
        />
      </label>
      <label className="admin-field-label">
        Floor Name
        <input
          className="admin-input"
          placeholder="e.g. Ground Floor"
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </label>
      <button
        className="btn btn-primary btn-sm"
        disabled={saving || !f.name.trim()}
        onClick={() => onSave(f)}
      >
        {saving ? "Saving..." : "Add Floor"}
      </button>
      <button className="btn btn-secondary btn-sm" onClick={onCancel}>
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
    <div className="admin-card">
      <div className="admin-form-row">
        <label className="admin-field-label">
          Room Name
          <input
            className="admin-input"
            placeholder="e.g. Room 101"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="admin-field-label">
          Room Type
          <select
            className="form-select"
            value={f.room_type}
            onChange={(e) => set("room_type", e.target.value)}
          >
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>{label(t)}</option>
            ))}
          </select>
        </label>
        <label className="admin-field-label">
          Capacity
          <input
            className="admin-input"
            placeholder="30"
            type="number"
            min={1}
            value={f.capacity}
            onChange={(e) => set("capacity", Number(e.target.value))}
          />
        </label>
      </div>
      <div className="admin-form-row">
        <input
          className="admin-input"
          placeholder="Description (optional)"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <div className="admin-form-row">
        {EQUIPMENT_OPTIONS.map((eq) => (
          <label key={eq} className="form-label">
            <input
              type="checkbox"
              checked={f.equipment.includes(eq)}
              onChange={() => toggleEquip(eq)}
            />
            {" "}{label(eq)}
          </label>
        ))}
      </div>
      <div className="admin-page-controls">
        <button
          className="btn btn-primary btn-sm"
          disabled={saving || !f.name.trim()}
          onClick={() => onSave({ ...f, floor_id: floorId })}
        >
          {saving ? "Saving..." : initial ? "Update Room" : "Add Room"}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Main Page

export default function ManageSpaces() {
  const [buildings, setBuildings] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Which inline form is open: { type: "building" | "floor" | "room" | "editBuilding" | "editRoom", id? }
  const [formOpen, setFormOpen] = useState(null);

  // Fetch buildings
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

  // Expand / collapse building
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

  // CRUD helpers
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
      for (const [bid, data] of Object.entries(expanded)) {
        if (data.floors.some((f) => f.id === form.floor_id)) {
          const next = { ...expanded };
          delete next[bid];
          setExpanded(next);
          await toggleExpand(bid);
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
      const ids = Object.keys(expanded);
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
      const ids = Object.keys(expanded);
      setExpanded({});
      for (const id of ids) await toggleExpand(id);
      await fetchBuildings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Render
  if (loading) return <div className="admin-loading">Loading spaces...</div>;

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Manage Spaces</h1>
        <button
          className="btn btn-primary"
          onClick={() => setFormOpen({ type: "building" })}
        >
          + Add Building
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="alert-danger">
          <span>{error}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setError(null)}>
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
        <div className="empty-state">
          <p>No buildings yet. Add one to get started.</p>
        </div>
      )}

      {buildings.map((b) => {
        const isExpanded = !!expanded[b.id];
        const detail = expanded[b.id];

        return (
          <div key={b.id} className="admin-card">
            {/* Building header */}
            <div className="admin-card-header" onClick={() => toggleExpand(b.id)}>
              <div>
                <div className="admin-card-title">
                  {isExpanded ? "\u25BC" : "\u25B6"} {b.name} <span className="badge-muted" style={{ marginLeft: 8 }}>{b.code}</span>
                </div>
                <div className="admin-card-meta">
                  {b.address || "No address"} &middot; {b.total_floors ?? "?"} floor(s) &middot; {b.room_count ?? 0} room(s)
                </div>
              </div>
              <div className="admin-page-controls" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setFormOpen({ type: "editBuilding", data: { id: b.id, name: b.name, code: b.code, address: b.address || "" } })
                  }
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteBuilding(b.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Edit building form */}
            {formOpen?.type === "editBuilding" && formOpen.data?.id === b.id && (
              <div className="admin-card-body">
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
              <div className="admin-card-body">
                <div className="admin-page-header">
                  <span className="admin-card-title">Floors</span>
                  <button
                    className="btn btn-primary btn-sm"
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
                  <div className="admin-card-meta">No floors yet.</div>
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
                      <div key={floor.id} className="admin-card">
                        <div className="admin-card-header">
                          <span className="admin-card-title">
                            Floor {floor.floor_number} &mdash; {floor.name} <span className="badge-muted" style={{ marginLeft: 8 }}>{floorRooms.length} room(s)</span>
                          </span>
                          <div className="admin-page-controls">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setFormOpen({ type: "room", floorId: floor.id, buildingId: b.id })}
                            >
                              + Room
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
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
                              <div className="admin-card-header">
                                <div>
                                  <span className="admin-card-title">{room.name}</span>
                                  <span className="badge-muted" style={{ marginLeft: 8, marginRight: 8 }}>{label(room.room_type || "unknown")}</span>
                                  <span className="admin-card-meta">
                                    Capacity: {room.capacity}
                                  </span>
                                </div>
                                <div className="admin-page-controls">
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() =>
                                      setFormOpen({ type: "editRoom", data: room })
                                    }
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
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
                          <div className="admin-card-meta">No rooms on this floor.</div>
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
