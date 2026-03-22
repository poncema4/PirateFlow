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

const styles = {
  page: {
    padding: "1.5rem",
    maxWidth: 1100,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.25rem",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: 0,
  },
  controls: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    flexWrap: "wrap",
  },
  select: {
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.4rem 0.75rem",
    fontSize: 13,
    outline: "none",
  },
  btnPrimary: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.45rem 1rem",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDanger: {
    background: "transparent",
    color: "var(--danger)",
    border: "1px solid var(--danger)",
    borderRadius: 6,
    padding: "0.3rem 0.6rem",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSmall: {
    background: "transparent",
    color: "var(--accent)",
    border: "1px solid var(--accent)",
    borderRadius: 6,
    padding: "0.3rem 0.6rem",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnCancel: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0.3rem 0.6rem",
    fontSize: 11,
    cursor: "pointer",
  },
  card: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "0.65rem 0.75rem",
    color: "var(--text-muted)",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-primary)",
  },
  td: {
    padding: "0.6rem 0.75rem",
    color: "var(--text-primary)",
    borderBottom: "1px solid var(--border)",
  },
  badge: (role) => ({
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "0.15rem 0.5rem",
    borderRadius: 999,
    background:
      role === "admin"
        ? "var(--danger)"
        : role === "staff"
        ? "var(--accent)"
        : "#6366f122",
    color:
      role === "admin"
        ? "#fff"
        : role === "staff"
        ? "#fff"
        : "#818cf8",
  }),
  formRow: {
    background: "var(--bg-primary)",
    borderBottom: "1px solid var(--border)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "0.5rem",
    padding: "0.75rem",
  },
  input: {
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0.4rem 0.6rem",
    fontSize: 12,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  formActions: {
    display: "flex",
    gap: "0.4rem",
    padding: "0 0.75rem 0.75rem",
  },
  error: {
    background: "var(--danger)",
    color: "#fff",
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: "1rem",
  },
  empty: {
    padding: "2rem",
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 13,
  },
  loading: {
    padding: "2rem",
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 13,
  },
};

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
      <div style={styles.formGrid}>
        <input style={styles.input} placeholder="Email" value={form.email} onChange={set("email")} required type="email" />
        {isCreate && (
          <input style={styles.input} placeholder="Password" value={form.password} onChange={set("password")} required type="password" />
        )}
        <input style={styles.input} placeholder="First name" value={form.first_name} onChange={set("first_name")} required />
        <input style={styles.input} placeholder="Last name" value={form.last_name} onChange={set("last_name")} required />
        <select style={styles.input} value={form.role} onChange={set("role")}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input style={styles.input} placeholder="Department" value={form.department} onChange={set("department")} />
        <input style={styles.input} placeholder="Major" value={form.major} onChange={set("major")} />
        <input style={styles.input} placeholder="Year" value={form.year} onChange={set("year")} />
        <input style={styles.input} placeholder="Student ID" value={form.student_id} onChange={set("student_id")} />
      </div>
      <div style={styles.formActions}>
        <button type="submit" style={styles.btnPrimary} disabled={submitting}>
          {submitting ? "Saving..." : isCreate ? "Create" : "Save"}
        </button>
        <button type="button" style={styles.btnCancel} onClick={onCancel}>Cancel</button>
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
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Manage Users</h1>
        <div style={styles.controls}>
          <select
            style={styles.select}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button style={styles.btnPrimary} onClick={() => { setShowAdd(true); setEditingId(null); }}>
            + Add User
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button
            style={{ marginLeft: 12, background: "transparent", color: "#fff", border: "1px solid #fff", borderRadius: 4, padding: "0.15rem 0.5rem", fontSize: 11, cursor: "pointer" }}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div style={styles.card}>
        {showAdd && (
          <div style={styles.formRow}>
            <div style={{ padding: "0.6rem 0.75rem 0", fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
              New User
            </div>
            <UserForm
              initial={EMPTY_FORM}
              onSubmit={handleCreate}
              onCancel={() => setShowAdd(false)}
              isCreate
            />
          </div>
        )}

        {loading ? (
          <div style={styles.loading}>Loading users...</div>
        ) : users.length === 0 ? (
          <div style={styles.empty}>No users found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Department</th>
                  <th style={styles.th}>Student ID</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) =>
                  editingId === u.id ? (
                    <tr key={u.id}>
                      <td colSpan={6} style={{ ...styles.td, padding: 0 }}>
                        <div style={styles.formRow}>
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
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={u.id}>
                      <td style={styles.td}>
                        {u.first_name} {u.last_name}
                      </td>
                      <td style={{ ...styles.td, color: "var(--text-muted)" }}>{u.email}</td>
                      <td style={styles.td}>
                        <span style={styles.badge(u.role)}>{u.role}</span>
                      </td>
                      <td style={styles.td}>{u.department || "—"}</td>
                      <td style={styles.td}>{u.student_id || "—"}</td>
                      <td style={styles.td}>
                        {deletingId === u.id ? (
                          <span style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Delete?</span>
                            <button style={styles.btnDanger} onClick={() => handleDelete(u.id)}>Yes</button>
                            <button style={styles.btnCancel} onClick={() => setDeletingId(null)}>No</button>
                          </span>
                        ) : (
                          <span style={{ display: "flex", gap: "0.35rem" }}>
                            <button style={styles.btnSmall} onClick={() => { setEditingId(u.id); setShowAdd(false); }}>Edit</button>
                            <button style={styles.btnDanger} onClick={() => setDeletingId(u.id)}>Delete</button>
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
