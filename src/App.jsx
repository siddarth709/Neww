import React, { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { AssuranceIllustration, FloatingVisuals } from "./components/FloatingVisuals";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("verify_session") || "null"); }
    catch { return null; }
  });
  const [mode, setMode] = useState("login");
  const [theme, setTheme] = useState(() => localStorage.getItem("verify_theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("verify_theme", theme);
  }, [theme]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(Boolean(session));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.token) { setChecking(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async r => {
        if (!r.ok) throw new Error("Session expired");
        return r.json();
      })
      .then(d => setSession(s => ({ ...s, user: d.user })))
      .catch(() => {
        localStorage.removeItem("verify_session");
        setSession(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const d = await r.json();
      if (!r.ok) { const detail = Array.isArray(d.detail) ? d.detail.map(x => x.msg).join(", ") : d.detail; throw new Error(detail || "Authentication failed"); }
      localStorage.setItem("verify_session", JSON.stringify(d));
      setSession(d);
    } catch (x) { setError(x.message); }
    finally { setLoading(false); }
  };

  if (checking) return <div className="screen-loader"><div className="loader-mark">V</div><span>Loading workspace</span></div>;
  if (!session) return <AuthScreen {...{ mode, setMode, email, setEmail, password, setPassword, loading, error, submit, theme, onToggleTheme: () => setTheme(t => t === "dark" ? "light" : "dark") }} />;

  const role = session?.user?.role || session?.role || (session?.user?.email === "owner@gmail.com" ? "admin" : "user");

  return <div className="app-transition">{role === "admin" ? <AdminDashboard theme={theme} onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")} session={session} onLogout={() => {
    localStorage.removeItem("verify_session");
    setSession(null);
  }} /> : <Dashboard theme={theme} onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")} session={session} onLogout={() => {
    localStorage.removeItem("verify_session");
    setSession(null);
  }} />}</div>;
}

function AuthScreen({ mode, setMode, email, setEmail, password, setPassword, loading, error, submit, theme, onToggleTheme }) {
  return (
    <div className="auth-page">
      <div className="auth-grid" /><FloatingVisuals variant="auth" />
      <header className="auth-nav">
        <div className="company-lockup"><div className="company-symbol">V</div><div><strong>VERIFAI</strong><span>MODEL ASSURANCE</span></div></div>
        <div className="auth-nav-right"><span className="auth-nav-note">Secure training verification platform</span><button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label="Toggle dark mode"><span className="theme-sun">☼</span><span className="theme-moon">☾</span></button></div>
      </header>
      <main className="auth-main">
        <section className="auth-intro">
          <span className="overline">MODEL ASSURANCE PLATFORM</span>
          <h1>Evidence for every<br />trained model.</h1>
          <p>Commit model artifacts, verify training activity and maintain a tamper-evident record of model provenance.</p>
          <div className="trust-row"><span>✓ Cryptographic hashes</span><span>✓ Authenticated access</span><span>✓ Audit history</span></div><AssuranceIllustration />
        </section>
        <section className="auth-box">
          <div className="auth-box-head"><span className="overline">WORKSPACE ACCESS</span><h2>{mode === "login" ? "Sign in" : "Create account"}</h2><p>{mode === "login" ? "Continue to your verification workspace." : "Create an account to manage model checkpoints."}</p></div>
          <form onSubmit={submit}>
            <label>Email address<input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="name@company.com" required /></label>
            <label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Minimum 8 characters" minLength="8" required /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="action-primary" disabled={loading}>{loading ? "PLEASE WAIT…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</button>
          </form>
          <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); }}>{mode === "login" ? "Need an account? Create one" : "Already registered? Sign in"}</button>
          <div className="security-note"><span>Protected workspace</span><span>PBKDF2 + JWT</span></div>
        </section>
      </main>
    </div>
  );
}
