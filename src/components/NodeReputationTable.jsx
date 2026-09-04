import React from "react";
import StatusPill from "./StatusPill";

function truncate(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }

export default function NodeReputationTable({ nodeStats }) {
  const nodes = Object.entries(nodeStats).sort((a, b) => (b[1].reputation || 0) - (a[1].reputation || 0));

  return (
    <section className="panel panel-table">
      <div className="panel-head">
        <div><span className="panel-kicker">NETWORK HEALTH</span><h2>Node reputation</h2></div>
        <span className="panel-count">{nodes.length} observed</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>NODE</th><th>REPUTATION</th><th>ACCEPTED</th><th>FLAGGED</th><th>STATE</th></tr></thead>
          <tbody>
            {nodes.length === 0 ? (
              <tr><td colSpan={5}>
                <div className="empty-state">
                  <div className="empty-icon">○</div>
                  <strong>No training nodes observed</strong>
                  <span>Nodes will appear here after the backend receives a verification contribution.</span>
                </div>
              </td></tr>
            ) : nodes.map(([node, stats]) => {
              const suspended = stats.reputation <= -100;
              const status = suspended ? "flagged" : stats.flagged > 0 ? "pending" : "verified";
              return (
                <tr key={node}>
                  <td><span className="node-id"><span className="node-avatar">{node.slice(2, 4).toUpperCase()}</span>{truncate(node)}</span></td>
                  <td><div className="reputation"><span>{stats.reputation ?? 0}</span><div className="rep-bar"><i style={{ width: `${Math.max(0, Math.min(100, stats.reputation || 0))}%` }} /></div></div></td>
                  <td className="num">{stats.accepted || 0}</td>
                  <td className="num">{stats.flagged || 0}</td>
                  <td><StatusPill status={status}>{suspended ? "Suspended" : status === "pending" ? "Review" : "Trusted"}</StatusPill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
