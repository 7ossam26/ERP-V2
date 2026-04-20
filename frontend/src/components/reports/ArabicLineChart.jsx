import React from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

export default function ArabicLineChart({ labels = [], datasets = [], title }) {
  const chartData = {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + "20",
      tension: 0.4,
      fill: datasets.length === 1,
      pointRadius: labels.length > 30 ? 0 : 3,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { font: { family: "inherit" } } },
      title: title ? { display: true, text: title, font: { family: "inherit", size: 14 } } : { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م`,
        },
      },
    },
    scales: {
      x: { ticks: { font: { family: "inherit" }, maxRotation: 45 } },
      y: { ticks: { callback: (v) => v.toLocaleString("en-US") } },
    },
  };

  if (!labels.length) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">لا توجد بيانات</div>;

  return <Line data={chartData} options={options} />;
}
