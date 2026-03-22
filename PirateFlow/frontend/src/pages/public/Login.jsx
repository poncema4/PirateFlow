import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../api/client";

const TAB_STYLE = (active) => ({
  flex: 1,
  padding: "8px 0",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  background: "none",
  border: "none",
  borderBottom: `2px solid ${active ? "#004B8D" : "transparent"}`,
  color: active ? "#004B8D" : "#7a6a52",
  transition: "all 150ms",
  fontFamily: "'DM Sans', system-ui, sans-serif",
});

const INPUT_STYLE = {
  background: "#f8f4ec",
  border: "1px solid #ddd5c4",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "#1b2f4e",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 150ms",
  fontFamily: "'DM Sans', system-ui, sans-serif",
};

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14,
      border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff",
      borderRadius: "50%", display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.pathname || null;

  const [tab, setTab] = useState("id");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    return <Navigate to={user.role === "admin" ? "/dashboard" : "/"} replace />;
  }

  const handleSuccess = (data) => {
    login(data.user, { access_token: data.access_token, refresh_token: data.refresh_token });
    const dest = from ?? (data.user.role === "admin" ? "/dashboard" : "/");
    window.location.href = dest;
  };

  const handleIdLookup = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    setError("");
    setLoading(true);
    try {
      const data = await api.studentLookup(studentId.trim());
      handleSuccess(data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) setError("No student found with that ID number.");
      else if (status === 429) setError("Too many attempts. Please wait a moment.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePirateNet = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(email.trim(), password);
      handleSuccess(data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403 || status === 422) setError("Invalid email or password.");
      else if (status === 429) setError("Too many login attempts. Please wait a moment.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8f4ec" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          className="rounded-2xl p-7 flex flex-col gap-4"
          style={{ background: "#fff", border: "1px solid #ddd5c4", boxShadow: "0 2px 16px rgba(0,75,141,.08)" }}
        >
          {/* Branding */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <img src="/PirateFlow.png" alt="PirateFlow" style={{ width: 48, height: 48, objectFit: "contain" }} />
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 22, fontWeight: 700, color: "#004B8D", letterSpacing: "-0.5px",
            }}>
              PirateFlow
            </h1>
            <p style={{ fontSize: 11, color: "#7a6a52" }}>
              Seton Hall University &middot; Campus Space Booking
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #ddd5c4" }}>
            <button style={TAB_STYLE(tab === "id")} onClick={() => { setTab("id"); setError(""); }}>
              Student ID
            </button>
            <button style={TAB_STYLE(tab === "piratenet")} onClick={() => { setTab("piratenet"); setError(""); }}>
              PirateNet Login
            </button>
          </div>

          {/* Student ID Tab */}
          {tab === "id" && (
            <form onSubmit={handleIdLookup} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="student-id" style={{ fontSize: 12, fontWeight: 500, color: "#7a6a52" }}>
                  SHU ID Number
                </label>
                <input
                  id="student-id" type="text" inputMode="numeric" autoComplete="off" required
                  value={studentId} onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 7))}
                  placeholder="e.g. 9012345" maxLength={7} style={INPUT_STYLE}
                  onFocus={(e) => (e.target.style.borderColor = "#004B8D")}
                  onBlur={(e) => (e.target.style.borderColor = "#ddd5c4")}
                />
                <p style={{ fontSize: 10, color: "#7a6a52" }}>Enter your 7-digit student ID from your SHU card</p>
              </div>

              {error && (
                <p role="alert" style={{
                  fontSize: 12, color: "#8b2a2a", background: "#faeaea",
                  border: "1px solid rgba(139,42,42,.25)", borderRadius: 6, padding: "6px 10px",
                }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading || studentId.length < 7} style={{
                background: (loading || studentId.length < 7) ? "#ddd5c4" : "#004B8D",
                color: (loading || studentId.length < 7) ? "#7a6a52" : "#fff",
                border: "none", borderRadius: 8, padding: "10px 0",
                fontSize: 13, fontWeight: 600, width: "100%",
                cursor: (loading || studentId.length < 7) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all .22s ease",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}>
                {loading && <Spinner />}
                {loading ? "Looking up..." : "Continue"}
              </button>
            </form>
          )}

          {/* PirateNet Tab */}
          {tab === "piratenet" && (
            <form onSubmit={handlePirateNet} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="email" style={{ fontSize: 12, fontWeight: 500, color: "#7a6a52" }}>Email</label>
                <input id="email" type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@shu.edu" style={INPUT_STYLE}
                  onFocus={(e) => (e.target.style.borderColor = "#004B8D")}
                  onBlur={(e) => (e.target.style.borderColor = "#ddd5c4")}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="password" style={{ fontSize: 12, fontWeight: 500, color: "#7a6a52" }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    style={{ ...INPUT_STYLE, paddingRight: 46 }}
                    onFocus={(e) => (e.target.style.borderColor = "#004B8D")}
                    onBlur={(e) => (e.target.style.borderColor = "#ddd5c4")}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "#7a6a52", fontSize: 11, padding: 2,
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" style={{
                  fontSize: 12, color: "#8b2a2a", background: "#faeaea",
                  border: "1px solid rgba(139,42,42,.25)", borderRadius: 6, padding: "6px 10px",
                }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} style={{
                background: loading ? "#ddd5c4" : "#004B8D",
                color: loading ? "#7a6a52" : "#fff",
                border: "none", borderRadius: 8, padding: "10px 0",
                fontSize: 13, fontWeight: 600, width: "100%",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all .22s ease",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}>
                {loading && <Spinner />}
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Demo credentials */}
          <div style={{ background: "#f8f4ec", border: "1px solid #ddd5c4", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontSize: 9, color: "#7a6a52", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Demo accounts
            </p>
            <div className="flex flex-col gap-0.5">
              {tab === "id" ? (
                [
                  { label: "Student", id: "9012345" },
                  { label: "Staff", id: "9067890" },
                  { label: "Admin", id: "9078901" },
                ].map(({ label, id }) => (
                  <button key={id} type="button" onClick={() => setStudentId(id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      textAlign: "left", padding: "1px 0", color: "#7a6a52", fontSize: 11,
                      display: "flex", gap: 6, fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}>
                    <span style={{ color: "#004B8D", fontWeight: 600, minWidth: 42 }}>{label}</span>
                    <span>{id}</span>
                  </button>
                ))
              ) : (
                [
                  { label: "Admin", email: "admin@shu.edu" },
                  { label: "Staff", email: "staff@shu.edu" },
                  { label: "Student", email: "student@shu.edu" },
                ].map(({ label, email: e }) => (
                  <button key={e} type="button" onClick={() => { setEmail(e); setPassword("openshu2026"); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      textAlign: "left", padding: "1px 0", color: "#7a6a52", fontSize: 11,
                      display: "flex", gap: 6, fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}>
                    <span style={{ color: "#004B8D", fontWeight: 600, minWidth: 42 }}>{label}</span>
                    <span>{e} &middot; openshu2026</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <button onClick={() => navigate("/")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#7a6a52", fontSize: 11, padding: 2,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}>
            Back to campus
          </button>
        </div>
      </div>
    </div>
  );
}
