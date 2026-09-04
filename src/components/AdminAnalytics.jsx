import React, { useMemo } from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const chartOptions = { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:"bottom",labels:{boxWidth:10,usePointStyle:true,font:{family:"IBM Plex Mono",size:9}}}}, scales:{y:{beginAtZero:true,grid:{color:"rgba(255,255,255,.06)"},border:{display:false},ticks:{font:{family:"IBM Plex Mono",size:9}}},x:{grid:{display:false},border:{display:false},ticks:{font:{family:"IBM Plex Mono",size:9}}}} };

export default function AdminAnalytics({ nodeStats, roundHistory, events, models }) {
  const nodes = useMemo(() => Object.entries(nodeStats).map(([node, n]) => ({ node, accepted:n.accepted||0, flagged:n.flagged||0, reputation:n.reputation ?? 100 })), [nodeStats]);
  const rounds = useMemo(() => roundHistory.map((r,i)=>({label:`R${r.round ?? r.round_id ?? i+1}`, accepted:Number(r.accepted||0), rejected:Number(r.rejected||0), accuracy: typeof r.accuracy === "number" ? (r.accuracy<=1?r.accuracy*100:r.accuracy) : null})), [roundHistory]);
  const anomalies = useMemo(() => events.filter(e=>typeof e.anomaly_score === "number").slice().reverse().slice(-20).map((e,i)=>({label:`#${i+1}`,score:Number(e.anomaly_score)})), [events]);
  const risk = nodes.filter(n=>n.flagged>0).length;
  const totalUpdates = nodes.reduce((s,n)=>s+n.accepted+n.flagged,0);
  const verified = nodes.reduce((s,n)=>s+n.accepted,0);
  const efficiency = totalUpdates ? Math.round(verified/totalUpdates*100) : null;
  const artifactBytes = models.reduce((s,m)=>s+Number(m.size_bytes||m.size||0),0);
  return <div className="analytics-stack">
    <div className="insight-grid">
      <Insight label="Live efficiency" value={efficiency===null?"—":`${efficiency}%`} note="Accepted updates / observed updates" />
      <Insight label="Node risk" value={nodes.length?`${Math.round(risk/nodes.length*100)}%`:"—"} note={`${risk} node${risk===1?"":"s"} with flagged updates`} danger={risk>0}/>
      <Insight label="Anomaly observations" value={anomalies.length} note="Scored events retained in this session" />
      <Insight label="Artifact footprint" value={formatBytes(artifactBytes)} note={`${models.length} registered artifact${models.length===1?"":"s"}`} />
    </div>
    <div className="analytics-grid">
      <ChartPanel title="Node acceptance vs flagged" eyebrow="NETWORK QUALITY"><div className="analytics-chart"><Bar data={{labels:nodes.map(n=>shortNode(n.node)),datasets:[{label:"Verified",data:nodes.map(n=>n.accepted),borderRadius:5},{label:"Flagged",data:nodes.map(n=>n.flagged),borderRadius:5}]}} options={chartOptions}/></div></ChartPanel>
      <ChartPanel title="Round throughput" eyebrow="TRAINING PERFORMANCE"><div className="analytics-chart"><Bar data={{labels:rounds.map(r=>r.label),datasets:[{label:"Accepted",data:rounds.map(r=>r.accepted),borderRadius:5},{label:"Rejected",data:rounds.map(r=>r.rejected),borderRadius:5}]}} options={chartOptions}/></div></ChartPanel>
      <ChartPanel title="Anomaly score trend" eyebrow="SECURITY SIGNAL"><div className="analytics-chart"><Line data={{labels:anomalies.map(a=>a.label),datasets:[{label:"Anomaly score",data:anomalies.map(a=>a.score),tension:.35,pointRadius:2}]}} options={chartOptions}/></div></ChartPanel>
      <ChartPanel title="Network health mix" eyebrow="REPUTATION"><div className="analytics-donut"><Doughnut data={{labels:["Healthy nodes","Flagged-risk nodes"],datasets:[{data:[Math.max(0,nodes.length-risk),risk]}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{boxWidth:10,usePointStyle:true,font:{family:"IBM Plex Mono",size:9}}}}}} /></div></ChartPanel>
    </div>
  </div>;
}
function ChartPanel({title,eyebrow,children}){return <section className="corp-panel analytics-panel"><div className="panel-title"><div><span className="overline">{eyebrow}</span><h3>{title}</h3></div></div>{children}</section>}
function Insight({label,value,note,danger}){return <div className="stat-card insight-card"><span>{label}</span><strong className={danger?"metric-danger":""}>{value}</strong><small>{note}</small></div>}
function shortNode(v){return v ? `${v.slice(0,6)}…${v.slice(-4)}` : "unknown"}
function formatBytes(bytes){if(!bytes)return "0 B";const u=["B","KB","MB","GB"];let i=0,n=bytes;while(n>=1024&&i<u.length-1){n/=1024;i++;}return `${n.toFixed(i?1:0)} ${u[i]}`}
