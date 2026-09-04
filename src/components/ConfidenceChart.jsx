import React from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from "chart.js";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);
export default function ConfidenceChart({roundHistory}) {
 const values=roundHistory.map(r=>Math.round((r.accepted/Math.max(1,r.accepted+r.rejected))*100));
 const data={labels:roundHistory.map(r=>`R${r.round ?? r.round_id}`),datasets:[{data:values,borderColor:"#8ee6bd",backgroundColor:"rgba(142,230,189,.08)",borderWidth:2,pointRadius:3,pointHoverRadius:5,pointBackgroundColor:"#8ee6bd",fill:true,tension:.35}]};
 const options={responsive:true,maintainAspectRatio:false,animation:{duration:700,easing:"easeOutQuart"},plugins:{legend:{display:false},tooltip:{displayColors:false,backgroundColor:"#111821",titleFont:{family:"IBM Plex Mono"},bodyFont:{family:"IBM Plex Mono"},padding:10,callbacks:{label:c=>` ${c.parsed.y}% confidence`}}},scales:{y:{min:0,max:100,grid:{color:"rgba(255,255,255,.06)"},border:{display:false},ticks:{font:{family:"IBM Plex Mono",size:10},color:"#74808d",callback:v=>`${v}%`}},x:{grid:{display:false},border:{display:false},ticks:{font:{family:"IBM Plex Mono",size:10},color:"#74808d"}}}};
 return <section className="panel chart-panel"><div className="panel-head"><div><span className="panel-kicker">MODEL INTEGRITY</span><h2>Verification confidence</h2></div><span className="panel-count">PER ROUND</span></div><div className="chart-area">{roundHistory.length===0?<div className="chart-empty"><div className="chart-loader"><span/></div><strong>Waiting for finalized rounds</strong><small>Confidence telemetry will render here in real time.</small></div>:<Line data={data} options={options}/>}</div></section>;
}
