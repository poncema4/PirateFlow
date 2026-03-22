import { useEffect, useState } from "react";
import { api } from "../../api/client";

const ROLES = ["admin", "staff", "student"];

const EMPTY_FORM = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  role: "student",
  department: "",
  major: "",
  year: "",
  student_id: "",
};

function roleBadgeColor(role) {
  if (role === "admin") return { background: "var(--danger)", color: "#fff" };
  if (role === "staff") return { background: "var(--accent)", color: "#fff" };
  return { background: "#6366f122", color: "#818cf8" };
}

function UserForm({ initial, onSubmit, onCancel, isCreate }) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handle}>
      <div className="form-row">
        <input className="form-input" placeholder="Email" value={form.email} onChange={set("email")} required type="email" />
        {isCreate && (
          <input className="form-input" placeholder="Password" value={form.password} onChange={set("password")} required type="password" />
        )}
        <input className="form-input" placeholder="First name" value={form.first_name} onChange={set("first_name")} required />
        <input className="form-input" placeholder="Last name" value={form.last_name} onChange={set("last_name")} required />
        <select className="form-select" value={form.role} onChange={set("role")}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input className="form-input" placeholder="Department" value={form.department} onChange={set("department")} />
        <input className="form-input" placeholder="Major" value={form.major} onChange={set("major")} />
        <input className="form-input" placeholder="Year" value={form.year} onChange={set("year")} />
        <input className="form-input" placeholder="Student ID" value={form.student_id} onChange={set("student_id")} />
      </div>
      <div className="admin-page-controls">
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? "Saving..." : isCreate ? "Create" : "Save"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchUsers = async (role) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: 1, page_size: 100 };
      if (role) params.role = role;
      const data = await api.getUsers(params);
      setUsers(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(roleFilter);
  }, [roleFilter]);

  const handleCreate = async (form) => {
    try {
      await api.createUser(form);
      setShowAdd(false);
      await fetchUsers(roleFilter);
    } catch (err) {
      setError(err.message || "Failed to create user");
    }
  };

  const handleUpdate = async (form) => {
    try {
      const { password, ...payload } = form;
      await api.updateUser(editingId, payload);
      setEditingId(null);
      await fetchUsers(roleFilter);
    } catch (err) {
      setError(err.message || "Failed to update user");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteUser(id);
      setDeletingId(null);
      await fetchUsers(roleFilter);
    } catch (err) {
      setError(err.message || "Failed to delete user");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Manage Users</h1>
        <div className="admin-page-controls">
          <select
            className="form-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => { setShowAdd(true); setEditingId(null); }}>
            + Add User
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-danger">
          {error}
          <button className="btn btn-secondary btn-sm" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="admin-card">
        {showAdd && (
          <div className="admin-card-body">
            <p className="admin-card-title">New User</p>
            <UserForm
              initial={EMPTY_FORM}
              onSubmit={handleCreate}
              onCancel={() => setShowAdd(false)}
              isCreate
            />
          </div>
        )}

        {loading ? (
          <div className="admin-loading">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <p>No users found.</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Student ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) =>
                  editingId === u.id ? (
                    <tr key={u.id}>
                      <td colSpan={6}>
                        <UserForm
                          initial={{
                            email: u.email || "",
                            password: "",
                            first_name: u.first_name || "",
                            last_name: u.last_name || "",
                            role: u.role || "student",
                            department: u.department || "",
                            major: u.major || "",
                            year: u.year || "",
                            student_id: u.student_id || "",
                          }}
                          onSubmit={handleUpdate}
                          onCancel={() => setEditingId(null)}
                          isCreate={false}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={u.id}>
                      <td>{u.first_name} {u.last_name}</td>
                      <td className="text-muted">{u.email}</td>
                      <td>
                        <span className="pill" style={roleBadgeColor(u.role)}>{u.role}</span>
                      </td>
                      <td>{u.department || "—"}</td>
                      <td>{u.student_id || "—"}</td>
                      <td>
                        {deletingId === u.id ? (
                          <span className="admin-page-controls">
                            <span className="badge-muted">Delete?</span>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>Yes</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setDeletingId(null)}>No</button>
                          </span>
                        ) : (
                          <span className="admin-page-controls">
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditingId(u.id); setShowAdd(false); }}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDeletingId(u.id)}>Delete</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
