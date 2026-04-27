import React from "react";
import { Check } from "lucide-react";

const Step = ({ number, label, complete = false, active = false, children }) => {
  const circleBase = "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-200";
  const circleClass = complete
    ? `${circleBase} bg-stock-ok border-stock-ok text-white`
    : active
    ? `${circleBase} bg-primary border-primary text-white`
    : `${circleBase} bg-transparent border-border-light text-text-light/50`;

  return (
    <div className="relative">
      <div className="flex items-center gap-3 mb-3">
        <div className={circleClass}>
          {complete ? <Check size={13} strokeWidth={3} /> : <span>{number}</span>}
        </div>
        <span className={`text-sm font-semibold tracking-wide ${active || complete ? "text-text-light dark:text-text-dark" : "text-text-light/50 dark:text-text-dark/50"}`}>
          {label}
        </span>
      </div>
      <div className="mr-3.5 pr-4 border-r-2 border-border-light dark:border-border-dark pb-5">
        {children}
      </div>
    </div>
  );
};

export default Step;
