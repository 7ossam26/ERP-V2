import React from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4"];

export default function ArabicPieChart({ labels = [], data = [], title }) {
  const chartData = {
    labels,
    datasets: [{ data, backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]), borderWidth: 2 }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { font: { family: "inherit" }, boxWidth: 12 } },
      title: title ? { display: true, text: title, font: { family: "inherit", size: 14 } } : { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${ctx.parsed.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م (${pct}%)`;
          },
        },
      },
    },
  };

  if (!labels.length) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">لا توجد بيانات</div>;

  return <Doughnut data={chartData} options={options} />;
}
