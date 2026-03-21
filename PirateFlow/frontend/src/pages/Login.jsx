import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import { api } from "../api/client";

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already authenticated — redirect away
  if (user) {
    return <Navigate to={user.role === "admin" ? "/dashboard" : "/spaces"} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.login(email.trim(), password);
      // data: { access_token, refresh_token, user: { id, email, first_name, last_name, role, ... } }
      login(data.user, { access_token: data.access_token, refresh_token: data.refresh_token });

      const dest = from ?? (data.user.role === "admin" ? "/dashboard" : "/spaces");
      window.location.href = dest;
    } catch (err) {
      // Never reveal whether the email exists — generic message always
      const status = err.response?.status;
      if (status === 401 || status === 403 || status === 422) {
        setError("Invalid email or password.");
      } else if (status === 429) {
        setError("Too many login attempts. Please wait a moment and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg-primary)" }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Card */}
        <div
          className="rounded-2xl p-8 flex flex-col gap-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {/* Branding */}
          <div className="flex flex-col items-center gap-2 text-center">
            <span style={{ fontSize: 40, lineHeight: 1 }}>🏴‍☠️</span>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: "-0.5px",
              }}
            >
              PirateFlow
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Campus Space Intelligence
              <br />
              <span style={{ fontSize: 12 }}>Seton Hall University</span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@shu.edu"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  outline: "none",
                  width: "100%",
                  boxSizing: "border-box",
                  transition: "border-color 150ms",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 40px 10px 12px",
                    fontSize: 14,
                    color: "var(--text-primary)",
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box",
                    transition: "border-color 150ms",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: 14,
                    padding: 4,
                    lineHeight: 1,
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "◡" : "◠"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p
                role="alert"
                style={{
                  fontSize: 13,
                  color: "var(--danger)",
                  background: "rgba(232,68,90,0.08)",
                  border: "1px solid rgba(232,68,90,0.25)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "var(--border)" : "var(--accent)",
                color: loading ? "var(--text-muted)" : "#000",
                border: "none",
                borderRadius: 8,
                padding: "11px 0",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 150ms, background 150ms",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {loading && (
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(0,0,0,0.3)",
                    borderTopColor: "#000",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
              )}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Demo credentials
            </p>
            <div className="flex flex-col gap-1">
              {[
                { label: "Admin", email: "admin@shu.edu" },
                { label: "Staff", email: "staff@shu.edu" },
                { label: "Student", email: "student@shu.edu" },
              ].map(({ label, email: demoEmail }) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => { setEmail(demoEmail); setPassword("openshu2026"); }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: "2px 0",
                    color: "var(--text-muted)",
                    fontSize: 12,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "var(--accent)", fontWeight: 600, minWidth: 46 }}>{label}</span>
                  <span>{demoEmail} · openshu2026</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
