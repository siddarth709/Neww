import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function TrainingEfficiencyChart({ roundHistory }) {
  const rows = useMemo(() => roundHistory.map((r) => {
    const accepted = Number(r.accepted || 0);
    const rejected = Number(r.rejected || 0);
    const total = Math.max(1, accepted + rejected);
    const efficiency = Math.round((accepted / total) * 100);
    const accuracy = typeof r.accuracy === "number" ? Math.round(r.accuracy <= 1 ? r.accuracy * 100 : r.accuracy) : null;
    return { label: `R${r.round ?? r.round_id ?? "—"}`, efficiency, accuracy };
  }), [roundHistory]);

  const data = {
    labels: rows.map((r) => r.label),
    datasets: [
      { label: "Training efficiency", data: rows.map((r) => r.efficiency), borderRadius: 5 },
      { label: "Model accuracy", data: rows.map((r) => r.accuracy), borderRadius: 5 },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 650, easing: "easeOutQuart" },
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 10, usePointStyle: true, font: { family: "IBM Plex Mono", size: 10 } } },
      tooltip: { displayColors: false, callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y ?? 0}%` } },
    },
    scales: {
      y: { min: 0, max: 100, grid: { color: "rgba(255,255,255,.06)" }, border: { display: false }, ticks: { font: { family: "IBM Plex Mono", size: 10 }, color: "#74808d", callback: (v) => `${v}%` } },
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: "IBM Plex Mono", size: 10 }, color: "#74808d" } },
    },
  };

  return (
    <section className="corp-panel efficiency-panel">
      <div className="panel-title">
        <div><span className="overline">COMPARATIVE ANALYSIS</span><h3>Training efficiency by round</h3></div>
        <span className="registry-count">HIGHER IS BETTER</span>
      </div>
      {rows.length === 0 ? (
        <div className="chart-empty"><strong>Waiting for finalized rounds</strong><small>Efficiency comparisons will appear after training rounds are finalized.</small></div>
      ) : (
        <>
          <p className="chart-note">Efficiency is calculated from the accepted-update rate for each finalized round. Model accuracy is shown when the training pipeline reports it.</p>
          <div className="efficiency-chart-area"><Bar data={data} options={options} /></div>
        </>
      )}
    </section>
  );
}
