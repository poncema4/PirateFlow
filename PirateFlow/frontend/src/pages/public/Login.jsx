import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../api/client";

function Spinner() {
  return (
    <span className="login-spinner" />
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
  const [idPassword, setIdPassword] = useState("");
  const [showIdPassword, setShowIdPassword] = useState(false);
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
    if (!studentId.trim() || !idPassword) return;
    setError("");
    setLoading(true);
    try {
      const data = await api.studentLookup(studentId.trim(), idPassword);
      handleSuccess(data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) setError("Invalid student ID or password.");
      else if (status === 404) setError("No student found with that ID number.");
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

  const idDisabled = loading || studentId.length < 8 || !idPassword;

  return (
    <div className="login-page">
        <div className="login-card">
          <div className="login-branding">
            <img src="/PirateFlow.png" alt="PirateFlow" />
            <h1>
              PirateFlow
            </h1>
            <p>
              Seton Hall University &middot; Campus Space Booking
            </p>
          </div>

          {/* Tabs */}
          <div className="login-tabs">
            {[
              { key: "id", label: "Student ID" },
              { key: "piratenet", label: "Pirate Email" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError(""); }}
                className={`login-tab ${tab === key ? "active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Student ID Tab */}
          {tab === "id" && (
            <form onSubmit={handleIdLookup} className="login-form">
              <div className="login-field">
                <label htmlFor="student-id" className="login-label">
                  SHU ID Number
                </label>
                <input
                  id="student-id"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="e.g. 90123456"
                  maxLength={8}
                  className="login-input"
                />
                <p className="login-hint">
                  Enter your 8-digit student ID from your SHU card
                </p>
              </div>

              <div className="login-field">
                <label htmlFor="id-password" className="login-label">
                  Password
                </label>
                <div className="login-password-wrap">
                  <input
                    id="id-password"
                    type={showIdPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={idPassword}
                    onChange={(e) => setIdPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="login-input"
                    style={{ paddingRight: 64 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowIdPassword((v) => !v)}
                    tabIndex={-1}
                    className="login-password-toggle"
                  >
                    {showIdPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="login-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={idDisabled}
                className="login-submit"
              >
                {loading && <Spinner />}
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* PirateNet Tab */}
          {tab === "piratenet" && (
            <form onSubmit={handlePirateNet} className="login-form">
              <div className="login-field">
                <label htmlFor="email" className="login-label">
                  Pirate Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="firstname.lastname@shu.edu"
                  className="login-input"
                />
              </div>

              <div className="login-field">
                <label htmlFor="password" className="login-label">
                  Password
                </label>
                <div className="login-password-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="login-input"
                    style={{ paddingRight: 64 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="login-password-toggle"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="login-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-submit"
              >
                {loading && <Spinner />}
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Back link */}
          <button
            onClick={() => navigate("/")}
            className="login-back"
          >
            &larr; Back to campus
          </button>
        </div>
    </div>
  );
}
