import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../api/client";

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

  const idDisabled = loading || studentId.length < 7;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-cream">
      <div className="w-full max-w-[420px]">
        {/* Card */}
        <div className="bg-card rounded-2xl p-8 flex flex-col gap-5 border border-border shadow-lg animate-[fadeUp_.35s_ease_both]">
          {/* Branding */}
          <div className="flex flex-col items-center gap-2 text-center mb-1">
            <img
              src="/PirateFlow.png"
              alt="PirateFlow"
              className="w-14 h-14 object-contain"
            />
            <h1 className="font-display text-2xl font-bold text-shu-blue tracking-tight">
              PirateFlow
            </h1>
            <p className="text-[13px] text-muted">
              Seton Hall University &middot; Campus Space Booking
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {[
              { key: "id", label: "Student ID" },
              { key: "piratenet", label: "PirateNet Login" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError(""); }}
                className={`
                  flex-1 py-2.5 text-[13px] font-semibold cursor-pointer
                  bg-transparent border-none border-b-2 transition-all duration-200 font-body
                  ${tab === key
                    ? "border-b-shu-blue text-shu-blue"
                    : "border-b-transparent text-muted hover:text-navy"
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Student ID Tab */}
          {tab === "id" && (
            <form onSubmit={handleIdLookup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="student-id" className="text-[13px] font-medium text-navy">
                  SHU ID Number
                </label>
                <input
                  id="student-id"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 7))}
                  placeholder="e.g. 9012345"
                  maxLength={7}
                  className="bg-cream border border-border rounded-xl px-4 py-3 text-sm text-navy outline-none w-full font-body transition-colors duration-200 focus:border-shu-blue placeholder:text-muted/50"
                />
                <p className="text-[11px] text-muted">
                  Enter your 7-digit student ID from your SHU card
                </p>
              </div>

              {error && (
                <p role="alert" className="text-[13px] text-danger bg-danger/8 border border-danger/20 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={idDisabled}
                className={`
                  w-full py-3 rounded-xl text-sm font-semibold
                  flex items-center justify-center gap-2
                  transition-all duration-200 border-none cursor-pointer font-body
                  ${idDisabled
                    ? "bg-border text-muted cursor-not-allowed"
                    : "bg-shu-blue text-white hover:bg-shu-blue-lt shadow-sm hover:shadow-md"
                  }
                `}
              >
                {loading && <Spinner />}
                {loading ? "Looking up..." : "Continue"}
              </button>
            </form>
          )}

          {/* PirateNet Tab */}
          {tab === "piratenet" && (
            <form onSubmit={handlePirateNet} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[13px] font-medium text-navy">
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
                  className="bg-cream border border-border rounded-xl px-4 py-3 text-sm text-navy outline-none w-full font-body transition-colors duration-200 focus:border-shu-blue placeholder:text-muted/50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-[13px] font-medium text-navy">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="bg-cream border border-border rounded-xl px-4 py-3 pr-16 text-sm text-navy outline-none w-full font-body transition-colors duration-200 focus:border-shu-blue placeholder:text-muted/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[12px] text-muted hover:text-navy font-body font-medium px-1 py-0.5"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-[13px] text-danger bg-danger/8 border border-danger/20 rounded-xl px-4 py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`
                  w-full py-3 rounded-xl text-sm font-semibold
                  flex items-center justify-center gap-2
                  transition-all duration-200 border-none cursor-pointer font-body
                  ${loading
                    ? "bg-border text-muted cursor-not-allowed"
                    : "bg-shu-blue text-white hover:bg-shu-blue-lt shadow-sm hover:shadow-md"
                  }
                `}
              >
                {loading && <Spinner />}
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Demo credentials */}
          <div className="bg-cream border border-border rounded-xl p-4">
            <p className="text-[10px] text-muted mb-2.5 font-bold uppercase tracking-widest">
              Demo Accounts
            </p>
            <div className="flex flex-col gap-1.5">
              {tab === "id" ? (
                [
                  { label: "Student", id: "9012345" },
                  { label: "Staff", id: "9067890" },
                  { label: "Admin", id: "9078901" },
                ].map(({ label, id }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStudentId(id)}
                    className="flex items-center gap-3 bg-transparent border-none cursor-pointer text-left py-1.5 px-2 rounded-lg hover:bg-white transition-colors font-body text-[13px] text-muted group"
                  >
                    <span className="text-shu-blue font-semibold min-w-[52px]">{label}</span>
                    <span className="group-hover:text-navy transition-colors">{id}</span>
                  </button>
                ))
              ) : (
                [
                  { label: "Admin", email: "admin@shu.edu" },
                  { label: "Staff", email: "staff@shu.edu" },
                  { label: "Student", email: "student@shu.edu" },
                ].map(({ label, email: e }) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setEmail(e); setPassword("openshu2026"); }}
                    className="flex items-center gap-3 bg-transparent border-none cursor-pointer text-left py-1.5 px-2 rounded-lg hover:bg-white transition-colors font-body text-[13px] text-muted group"
                  >
                    <span className="text-shu-blue font-semibold min-w-[52px]">{label}</span>
                    <span className="group-hover:text-navy transition-colors">{e} &middot; openshu2026</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Back link */}
          <button
            onClick={() => navigate("/")}
            className="bg-transparent border-none cursor-pointer text-muted text-[13px] font-body hover:text-navy transition-colors py-1"
          >
            &larr; Back to campus
          </button>
        </div>
      </div>
    </div>
  );
}
