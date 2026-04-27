import React from "react";
import { GitBranch } from "lucide-react";

const BranchChips = ({ branches, selectedId, onChange }) => {
  if (!branches.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-light/50 dark:text-text-dark/50 animate-pulse">
        <GitBranch size={15} />
        <span>جارٍ تحميل الفروع...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="اختر الفرع">
      {branches.map((b) => {
        const isSelected = String(b.id) === String(selectedId);
        return (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(String(b.id))}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
              ${isSelected
                ? "bg-primary border-primary text-white shadow-sm"
                : "bg-white dark:bg-surface-dark border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:border-primary/50"
              }
            `}
          >
            {b.name}
          </button>
        );
      })}
    </div>
  );
};

export default BranchChips;
