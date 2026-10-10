import React from "react";

// Rotating BerryModa accent set so module grids read as colorful but ordered.
// Full class strings are listed so Tailwind can detect them.
const TONES = [
  { tile: "bg-pink-100 text-pink-600", bar: "from-pink-500 to-rose-400", ring: "group-hover:ring-pink-200" },
  { tile: "bg-violet-100 text-violet-600", bar: "from-violet-500 to-fuchsia-400", ring: "group-hover:ring-violet-200" },
  { tile: "bg-orange-100 text-orange-600", bar: "from-orange-500 to-amber-400", ring: "group-hover:ring-orange-200" },
  { tile: "bg-teal-100 text-teal-600", bar: "from-teal-500 to-emerald-400", ring: "group-hover:ring-teal-200" },
  { tile: "bg-fuchsia-100 text-fuchsia-600", bar: "from-fuchsia-500 to-pink-400", ring: "group-hover:ring-fuchsia-200" },
  { tile: "bg-sky-100 text-sky-600", bar: "from-sky-500 to-indigo-400", ring: "group-hover:ring-sky-200" },
];

const ModuleCard = ({ icon, title, subtitle, onClick, index = 0 }) => {
  const tone = TONES[index % TONES.length];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full h-full text-right bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-card hover:shadow-glow ring-1 ring-transparent ${tone.ring} transition-all duration-300 hover:-translate-y-1 overflow-hidden p-5 sm:p-6 flex items-center gap-4 min-h-touch animate-fade-in-up`}>
      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${tone.bar} opacity-70 group-hover:opacity-100 transition-opacity`} />
      <span
        className={`${tone.tile} w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
        <span className="material-icons-round text-3xl">{icon}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-lg sm:text-xl font-bold text-text-light dark:text-text-dark group-hover:text-primary transition-colors">
          {title}
        </span>
        {subtitle && (
          <span className="block text-sm text-text-light/60 dark:text-text-dark/60 mt-1 leading-relaxed">
            {subtitle}
          </span>
        )}
      </span>
      <span className="material-icons-round text-text-light/25 dark:text-text-dark/25 group-hover:text-primary group-hover:-translate-x-1 transition-all">
        chevron_left
      </span>
    </button>
  );
};

export default ModuleCard;
