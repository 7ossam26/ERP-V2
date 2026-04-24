import React from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function ArabicBarChart({ labels = [], datasets = [], title, horizontal = false }) {
  const chartData = {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: (ds.colors || COLORS.slice(0, labels.length)).map ? (ds.colors || labels.map((_, j) => COLORS[j % COLORS.length])) : COLORS[i % COLORS.length],
      borderRadius: 4,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    plugins: {
      legend: { display: datasets.length > 1, position: "top", labels: { font: { family: "inherit" } } },
      title: title ? { display: true, text: title, font: { family: "inherit", size: 14 } } : { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label || ""}: ${ctx.parsed[horizontal ? "x" : "y"].toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م`,
        },
      },
    },
    scales: {
      x: { ticks: { font: { family: "inherit" } } },
      y: { ticks: { callback: (v) => typeof v === "number" ? v.toLocaleString("en-US") : v } },
    },
  };

  if (!labels.length) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">لا توجد بيانات</div>;

  return <Bar data={chartData} options={options} />;
}
