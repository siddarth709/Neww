import React, { useEffect, useMemo, useState } from "react";
import { useDashboardSocket } from "../hooks/useDashboardSocket";
import NodeReputationTable from "../components/NodeReputationTable";
import ConfidenceChart from "../components/ConfidenceChart";
import EventLog from "../components/EventLog";
import { FloatingVisuals } from "../components/FloatingVisuals";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function Dashboard({ session, onLogout, onToggleTheme }) {
  const { connected, events, nodeStats, roundHistory } = useDashboardSocket();
  const [section, setSection] = useState("overview");
  const [commitOpen, setCommitOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [round, setRound] = useState(1);
  const [commit, setCommit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState([]);
  const [modelLoading, setModelLoading] = useState(true);
  const [health, setHealth] = useState(null);

  const loadModels = async () => {
    setModelLoading(true);
    try {
      const r = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (r.ok) setModels((await r.json()).models || []);
    } finally { setModelLoading(false); }
  };

  useEffect(() => {
    loadModels();
    fetch(`${API}/health`).then(r => r.ok ? r.json() : null).then(setHealth).catch(() => setHealth(null));
  }, [session.token]);

  useEffect(() => {
    if (events.some(e => e.type === "model_committed")) loadModels();
  }, [events]);

  const metrics = useMemo(() => {
    const entries = Object.values(nodeStats);
    const accepted = entries.reduce((s, n) => s + (n.accepted || 0), 0);
    const flagged = entries.reduce((s, n) => s + (n.flagged || 0), 0);
    return {
      accepted,
      flagged,
      nodes: entries.length,
      confidence: accepted + flagged ? Math.round(accepted / (accepted + flagged) * 100) : null,
      rounds: roundHistory.length,
    };
  }, [nodeStats, roundHistory]);

  const commitModel = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setCommit(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("round_id", round);
      const r = await fetch(`${API}/models/commit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: fd
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const detail = Array.isArray(d.detail) ? d.detail.map(x => x.msg).join(", ") : d.detail;
        throw new Error(detail || "Commit failed");
      }
      setCommit(d);
      await loadModels();
    } catch (x) {
      setCommit({ error: x.message || "Commit failed" });
    } finally { setBusy(false); }
  };

  const nav = [
    ["overview", "Overview"],
    ["models", "Model registry"],
    ["network", "Network"],
    ["events", "Audit events"]
  ];
  const activeLabel = nav.find(n => n[0] === section)?.[1] || "Overview";

  return (
    <div className="corp-app">
      <FloatingVisuals variant="dashboard" />
      <aside className="sidebar">
        <div className="side-brand">
          <div className="side-symbol">V</div>
          <div><strong>VERIFAI</strong><span>MODEL ASSURANCE</span></div>
        </div>

        <div className="side-workspace">
          <span>WORKSPACE</span>
          <strong>Training verification</strong>
          <small>Authenticated workspace</small>
        </div>

        <nav className="side-nav">
          <span className="nav-heading">OPERATIONS</span>
          {nav.map(([id, label]) => (
            <button key={id} className={section === id ? "selected" : ""} onClick={() => setSection(id)}>
              <i className={`nav-icon icon-${id}`} />{label}
            </button>
          ))}
          <span className="nav-heading nav-lower">ACCOUNT</span>
          <button onClick={onLogout}><i className="nav-icon icon-signout" />Sign out</button>
        </nav>

        <div className="side-footer">
          <span className={health?.status === "ok" ? "status-dot good" : "status-dot"} />
          <span>{health?.status === "ok" ? "Backend connected" : "Backend unavailable"}</span>
          <small>{connected ? "Live verification stream active" : "Waiting for stream connection"}</small>
        </div>
      </aside>

      <div className="main-shell">
        <header className="corp-header">
          <div className="header-page">
            <span className="breadcrumb">Training verification / {activeLabel}</span>
            <h1>{activeLabel}</h1>
          </div>
          <div className="header-actions">
            <span className={`system-state ${connected && health?.status === "ok" ? "good" : "warn"}`}>
              <i />{connected && health?.status === "ok" ? "Operational" : "Connecting"}
            </span>
            <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label="Toggle theme">
              <span className="theme-sun">☼</span><span className="theme-moon">☾</span>
            </button>
            <div className="profile">
              <span className="avatar">{(session.user.email || "U")[0].toUpperCase()}</span>
              <span className="profile-email">{session.user.email}</span>
            </div>
          </div>
        </header>

        <main className="corp-content">
          <div key={section} className="page-transition">
            {section === "overview" && (
              <>
                <section className="welcome-row">
                  <div>
                    <span className="overline">MODEL ASSURANCE</span>
                    <h2>Training verification at a glance</h2>
                    <p>Track model provenance, federated training activity and cryptographic evidence from one workspace.</p>
                  </div>
                  <button className="action-primary" onClick={() => setCommitOpen(true)}>
                    Register model <span>→</span>
                  </button>
                </section>

                <div className="stat-grid">
                  <Stat label="Integrity confidence" value={metrics.confidence === null ? "—" : `${metrics.confidence}%`} note={metrics.confidence === null ? "No completed evaluations" : "Observed verification results"} />
                  <Stat label="Training nodes" value={metrics.nodes} note={metrics.nodes ? "Observed this session" : "No node activity yet"} />
                  <Stat label="Verified gradients" value={metrics.accepted} note={metrics.flagged ? `${metrics.flagged} flagged for review` : "No flagged contributions"} />
                  <Stat label="Model artifacts" value={models.length} note={models.length ? "Registered in workspace" : "Registry is empty"} />
                </div>

                <section className="feature-panel">
                  <div className="feature-copy">
                    <span className="overline">MODEL REGISTRY</span>
                    <h3>One source of truth for trained artifacts.</h3>
                    <p>Upload a checkpoint, compute its SHA-256 digest server-side and preserve the resulting evidence alongside the training round.</p>
                    <button className="secondary-btn" onClick={() => setSection("models")}>View model registry <span>→</span></button>
                  </div>
                  <div className="feature-metrics">
                    <div><strong>{models.length}</strong><span>artifacts</span></div>
                    <div><strong>{metrics.rounds}</strong><span>completed rounds</span></div>
                    <div><strong>{events.length}</strong><span>live events</span></div>
                  </div>
                </section>

                <div className="content-grid">
                  <ConfidenceChart roundHistory={roundHistory} />
                  <EventLog events={events.slice(-6)} />
                </div>

                <ModelsPanel models={models} loading={modelLoading} onCommit={() => setCommitOpen(true)} />
              </>
            )}

            {section === "models" && <ModelsPage models={models} loading={modelLoading} onCommit={() => setCommitOpen(true)} />}
            {section === "network" && (
              <div className="single-panel">
                <section className="section-intro">
                  <span className="overline">NETWORK</span>
                  <h2>Training node activity</h2>
                  <p>Only nodes observed through the verification stream are shown. No synthetic participants are displayed.</p>
                </section>
                <NodeReputationTable nodeStats={nodeStats} />
              </div>
            )}
            {section === "events" && (
              <div className="single-panel">
                <section className="section-intro">
                  <span className="overline">AUDIT</span>
                  <h2>Verification event history</h2>
                  <p>Live events received from the backend verification stream.</p>
                </section>
                <EventLog events={events} />
              </div>
            )}
          </div>
        </main>
      </div>

      {commitOpen && (
        <CommitDialog
          {...{ file, setFile, round, setRound, busy, commit, commitModel }}
          onClose={() => { setCommitOpen(false); setCommit(null); setFile(null); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, note }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function ModelsPanel({ models, loading, onCommit }) {
  return (
    <section className="corp-panel models-panel">
      <div className="panel-title">
        <div><span className="overline">MODEL REGISTRY</span><h3>Recent checkpoints</h3></div>
        <button className="text-action" onClick={onCommit}>Register model →</button>
      </div>
      <ModelTable models={models} loading={loading} />
    </section>
  );
}

function ModelsPage({ models, loading, onCommit }) {
  return (
    <>
      <section className="welcome-row">
        <div><span className="overline">MODEL REGISTRY</span><h2>Committed checkpoints</h2><p>Every uploaded artifact is hashed server-side and associated with a training round.</p></div>
        <button className="action-primary" onClick={onCommit}>Register model <span>→</span></button>
      </section>
      <ModelsPanel models={models} loading={loading} onCommit={onCommit} />
    </>
  );
}

function ModelTable({ models, loading }) {
  if (loading) return <div className="table-empty"><div className="inline-loader" />Loading model registry…</div>;
  if (!models.length) return (
    <div className="table-empty">
      <div className="empty-icon">＋</div>
      <strong>No model artifacts registered</strong>
      <span>Upload a .pt, .pth, .onnx, .bin or .safetensors checkpoint to create the first registry entry.</span>
    </div>
  );
  return (
    <div className="table-scroll">
      <table className="model-table">
        <thead><tr><th>MODEL</th><th>ROUND</th><th>SHA-256</th><th>SIZE</th><th>COMMITTED</th><th>TRANSACTION</th></tr></thead>
        <tbody>{models.map((m, i) => (
          <tr key={`${m.sha256}-${i}`}>
            <td><strong>{m.filename}</strong></td>
            <td>R{m.round_id}</td>
            <td><code>{m.sha256.slice(0, 10)}…{m.sha256.slice(-8)}</code></td>
            <td>{formatSize(m.size)}</td>
            <td>{formatDate(m.created_at)}</td>
            <td>{m.tx_hash ? <code>{m.tx_hash.slice(0, 10)}…{m.tx_hash.slice(-8)}</code> : <span className="muted">Stored</span>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function CommitDialog({ file, setFile, round, setRound, busy, commit, commitModel, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="modal">
        <div className="modal-head">
          <div><span className="overline">MODEL REGISTRY</span><h2>Register a model artifact</h2><p>The backend hashes the uploaded bytes before recording the artifact.</p></div>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={commitModel}>
          <label className="upload-box">
            <input type="file" accept=".pt,.pth,.onnx,.bin,.safetensors" onChange={e => setFile(e.target.files?.[0] || null)} />
            <span className="upload-icon">↑</span>
            <strong>{file ? file.name : "Select a model checkpoint"}</strong>
            <small>{file ? `${formatSize(file.size)} · ready to hash` : "PT · PTH · ONNX · BIN · SAFETENSORS · max 512 MB"}</small>
          </label>
          <div className="modal-fields">
            <label>Training round<input type="number" min="1" value={round} onChange={e => setRound(e.target.value)} /></label>
            <div className="hash-note"><span>INTEGRITY METHOD</span><strong>SHA-256</strong><small>Digest is computed by the backend from the stored artifact.</small></div>
          </div>
          {commit?.error && <div className="form-error">{commit.error}</div>}
          {commit && !commit.error && (
            <div className="commit-success">
              <strong>Artifact registered successfully.</strong>
              <span>SHA-256: {commit.model_hash}</span>
              {commit.tx_hash && <span>Transaction: {commit.tx_hash}</span>}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button className="action-primary" disabled={busy || !file}>{busy ? "PROCESSING…" : "Register artifact"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 2 : 0)} ${units[i]}`;
}
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
