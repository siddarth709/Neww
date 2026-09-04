import React from "react";

export default function RoundHero({ currentRound, connected, acceptedTotal, flaggedTotal }) {
  const total = acceptedTotal + flaggedTotal;
  const confidence = total ? Math.round((acceptedTotal / total) * 100) : 100;
  return <div className="round-card">
    <div className="round-card-top"><span className="section-label">CURRENT ROUND</span><span className={`mini-status ${connected ? "ok" : "warn"}`}><i />{connected ? "SYNCED" : "OFFLINE"}</span></div>
    <div className="round-number">{String(currentRound).padStart(2, "0")}</div>
    <div className="round-caption">verification cycle</div>
    <div className="confidence-row"><div><span className="confidence-value">{confidence}%</span><span className="confidence-label"> confidence</span></div><div className="confidence-track"><span style={{width:`${confidence}%`}} /></div></div>
  </div>;
}
