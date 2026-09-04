import React, { useEffect, useMemo, useState } from "react";
import { useDashboardSocket } from "../hooks/useDashboardSocket";
import NodeReputationTable from "../components/NodeReputationTable";
import ConfidenceChart from "../components/ConfidenceChart";
import EventLog from "../components/EventLog";
import { FloatingVisuals } from "../components/FloatingVisuals";
import TrainingEfficiencyChart from "../components/TrainingEfficiencyChart";
import AdminAnalytics from "../components/AdminAnalytics";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function AdminDashboard({ session, onLogout, onToggleTheme }) {
  const { connected, events, nodeStats, roundHistory } = useDashboardSocket();
  const [section, setSection] = useState("overview");
  const [models, setModels] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [m, h] = await Promise.all([
        fetch(`${API}/models`, { headers: { Authorization: `Bearer ${session.token}` } }),
        fetch(`${API}/health`)
      ]);
      if (m.ok) setModels((await m.json()).models || []);
      if (h.ok) setHealth(await h.json());
    } finally { setLoading(false); setLastRefresh(new Date()); }
  };

  useEffect(() => { load(); }, [session.token]);

  const metrics = useMemo(() => {
    const entries = Object.values(nodeStats);
    const accepted = entries.reduce((s, n) => s + (n.accepted || 0), 0);
    const flagged = entries.reduce((s, n) => s + (n.flagged || 0), 0);
    return {
      accepted, flagged, nodes: entries.length,
      confidence: accepted + flagged ? Math.round(accepted / (accepted + flagged) * 100) : null,
      rounds: roundHistory.length,
    };
  }, [nodeStats, roundHistory]);

  const nav = [
    ["overview", "Platform overview"],
    ["models", "Model registry"],
    ["network", "Training network"],
    ["rounds", "Verification rounds"],
    ["audit", "Audit log"],
    ["analytics", "Analytics"]
  ];
  const activeLabel = nav.find(n => n[0] === section)?.[1] || "Platform overview";

  return (
    <div className="corp-app admin-app">
      <FloatingVisuals variant="dashboard" />
      <aside className="sidebar admin-sidebar">
        <div className="side-brand"><div className="side-symbol">V</div><div><strong>VERIFAI</strong><span>ADMINISTRATION</span></div></div>
        <div className="admin-badge"><i /> Platform administrator</div>
        <div className="side-workspace"><span>CONTROL PLANE</span><strong>Training verification</strong><small>Privileged workspace</small></div>
        <nav className="side-nav">
          <span className="nav-heading">PLATFORM</span>
          {nav.map(([id, label]) => <button key={id} className={section === id ? "selected" : ""} onClick={() => setSection(id)}><i className={`nav-icon icon-${id}`} />{label}</button>)}
          <span className="nav-heading nav-lower">ACCOUNT</span>
          <button onClick={onLogout}><i className="nav-icon icon-signout" />Sign out</button>
        </nav>
        <div className="side-footer">
          <span className={health?.status === "ok" ? "status-dot good" : "status-dot"} />
          <span>{health?.status === "ok" ? "Platform operational" : "Backend unavailable"}</span>
          <small>{connected ? "Live control-plane stream active" : "Waiting for stream connection"}</small>
        </div>
      </aside>

      <div className="main-shell">
        <header className="corp-header admin-header">
          <div className="header-page"><span className="breadcrumb">Administration / {activeLabel}</span><h1>{activeLabel}</h1></div>
          <div className="header-actions"><button className="header-refresh" onClick={load}>↻ {lastRefresh ? "Refresh" : "Sync"}</button>
            <span className={`system-state ${connected && health?.status === "ok" ? "good" : "warn"}`}><i />{connected && health?.status === "ok" ? "Platform operational" : "Connecting"}</span>
            <button className="theme-toggle" type="button" onClick={onToggleTheme}><span className="theme-sun">☼</span><span className="theme-moon">☾</span></button>
            <div className="profile"><span className="avatar admin-avatar">A</span><span className="profile-email">{session.user.email}</span></div>
          </div>
        </header>

        <main className="corp-content">
          <div key={section} className="page-transition">
            {section === "overview" && <>
              <section className="welcome-row admin-welcome"><div><span className="overline">CONTROL PLANE</span><h2>Platform administration</h2><p>Monitor the verification infrastructure, training network and model evidence from the privileged workspace.</p></div><div className="admin-access">OWNER ACCESS<span>Privileged controls enabled</span></div></section>
              <div className="stat-grid admin-stats">
                <Stat label="Network nodes" value={metrics.nodes} note="Observed through live verification" />
                <Stat label="Registered artifacts" value={models.length} note="Current model registry" />
                <Stat label="Verification rounds" value={metrics.rounds} note="Rounds observed in this session" />
                <Stat label="Flagged contributions" value={metrics.flagged} note={metrics.flagged ? "Requires review" : "No flagged contributions"} danger={metrics.flagged > 0} />
              </div>
              <div className="admin-grid">
                <section className="corp-panel admin-system-panel"><div className="panel-title"><div><span className="overline">SYSTEM HEALTH</span><h3>Control-plane status</h3></div><span className="admin-live"><i />LIVE</span></div><div className="health-list"><HealthRow label="API service" ok={health?.status === "ok"} detail={health?.status === "ok" ? "Healthy" : "Unavailable"}/><HealthRow label="Blockchain connection" ok={health?.blockchain_connected} detail={health?.chain_id ? `Chain ${health.chain_id}` : "Not connected"}/><HealthRow label="WebSocket stream" ok={connected} detail={connected ? "Receiving events" : "Disconnected"}/><HealthRow label="Artifact registry" ok={!loading} detail={loading ? "Checking" : `${models.length} artifacts indexed`}/></div></section>
                <section className="corp-panel admin-snapshot"><div className="panel-title"><div><span className="overline">ASSURANCE</span><h3>Verification snapshot</h3></div></div><div className="admin-big-number">{metrics.confidence === null ? "—" : `${metrics.confidence}%`}<small>observed confidence</small></div><ConfidenceChart roundHistory={roundHistory} /></section>
              </div>
              <div className="content-grid"><NodeReputationTable nodeStats={nodeStats}/><EventLog events={events.slice(-8)}/></div>
            </>}
            {section === "models" && <AdminModels models={models} loading={loading} query={query} setQuery={setQuery} />}
            {section === "analytics" && <div className="single-panel"><section className="section-intro"><span className="overline">DECISION INTELLIGENCE</span><h2>Training analytics</h2><p>Compare training throughput, node quality, anomaly signals and artifact footprint using observed session data.</p></section><AdminAnalytics nodeStats={nodeStats} roundHistory={roundHistory} events={events} models={models}/></div>}
            {section === "network" && <div className="single-panel"><section className="section-intro"><span className="overline">NETWORK CONTROL</span><h2>Training network</h2><p>Observe participating nodes and their verification outcomes. No synthetic nodes are displayed.</p></section><NodeReputationTable nodeStats={nodeStats}/></div>}
            {section === "rounds" && <div className="single-panel"><section className="section-intro"><span className="overline">VERIFICATION</span><h2>Verification rounds</h2><p>Historical rounds received from the live verification stream.</p></section><ConfidenceChart roundHistory={roundHistory}/><TrainingEfficiencyChart roundHistory={roundHistory}/><div className="admin-round-list">{roundHistory.length ? roundHistory.map((r, i) => <div className="admin-round" key={i}><strong>Round {r.round_id ?? r.round ?? i + 1}</strong><span>{JSON.stringify(r)}</span></div>) : <Empty text="No finalized rounds observed yet."/>}</div></div>}
            {section === "audit" && <div className="single-panel"><section className="section-intro"><span className="overline">AUDIT</span><h2>Platform event log</h2><p>Live verification and model events visible to the administrator.</p></section><EventLog events={events}/></div>}
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({label,value,note,danger}) { return <div className="stat-card"><span>{label}</span><strong className={danger ? "metric-danger" : ""}>{value}</strong><small>{note}</small></div>; }
function HealthRow({label,ok,detail}) { return <div className="health-row"><span className={`health-indicator ${ok ? "ok" : "bad"}`} /><div><strong>{label}</strong><small>{detail}</small></div><em>{ok ? "Operational" : "Attention"}</em></div>; }
function Empty({text}) { return <div className="table-empty"><strong>{text}</strong></div>; }
function downloadJSON(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);}
function AdminModels({models,loading,query,setQuery}) { const filtered=models.filter(m => !query || `${m.filename||""} ${m.sha256||""} ${m.round_id||""}`.toLowerCase().includes(query.toLowerCase())); return <div className="single-panel"><section className="section-intro"><span className="overline">REGISTRY CONTROL</span><h2>Model registry</h2><p>Review model artifacts committed to the verification workspace.</p></section><section className="corp-panel models-panel"><div className="panel-title"><div><span className="overline">ARTIFACTS</span><h3>All registered checkpoints</h3></div><div className="registry-tools"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search artifacts…"/><span className="registry-count">{filtered.length} / {models.length}</span><button className="secondary-btn compact-btn" onClick={()=>downloadJSON(models,"verifai-model-registry.json")}>Export</button></div></div>{loading ? <div className="table-empty">Loading registry…</div> : filtered.length ? <div className="table-scroll"><table className="model-table"><thead><tr><th>MODEL</th><th>ROUND</th><th>SHA-256</th><th>SIZE</th><th>COMMITTED</th><th>TRANSACTION</th></tr></thead><tbody>{filtered.map((m,i)=><tr key={`${m.sha256}-${i}`}><td><strong>{m.filename || m.name || "checkpoint"}</strong></td><td>{m.round_id ?? "—"}</td><td><code>{m.sha256 || "—"}</code></td><td>{m.size_bytes ? `${Math.round(m.size_bytes/1024/1024*100)/100} MB` : "—"}</td><td>{m.committed_at ? new Date(m.committed_at).toLocaleString() : "—"}</td><td><code>{m.tx_hash || "—"}</code></td></tr>)}</tbody></table></div> : <Empty text="No model artifacts registered."/>}</section></div> }
