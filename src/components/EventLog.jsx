import React from "react";
import StatusPill from "./StatusPill";

function truncate(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }
const EVENT_STATUS = { gradient_verified: "verified", gradient_flagged: "flagged", gradient_revealed: "pending" };

export default function EventLog({ events = [] }) {
  return (
    <section className="panel event-panel">
      <div className="panel-head">
        <div><span className="panel-kicker">AUDIT TRAIL</span><h2>Recent activity</h2></div>
        <span className="stream-indicator"><i /> {events.length} events</span>
      </div>
      <div className="event-list">
        {events.length === 0 ? (
          <div className="event-empty">
            <div className="empty-icon">—</div>
            <strong>No verification activity</strong>
            <span>Training and verification events will appear here as the backend receives them.</span>
          </div>
        ) : events.map((e, i) => (
          <div className="event-row" key={`${e.type}-${e.round}-${i}`}>
            <div className="event-index">{String(i + 1).padStart(2, "0")}</div>
            <div className="event-main">
              <strong>{e.type?.replace("gradient_", "").replace("_", " ") || "event"}</strong>
              <span>node {truncate(e.node)}</span>
            </div>
            <span className="event-round">R{e.round ?? "—"}</span>
            {e.anomaly_score !== undefined && <span className="score">{Number(e.anomaly_score).toFixed(3)}</span>}
            <StatusPill status={EVENT_STATUS[e.type] || "pending"} />
          </div>
        ))}
      </div>
    </section>
  );
}
