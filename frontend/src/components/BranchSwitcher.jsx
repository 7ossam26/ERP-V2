import React, { useState, useRef, useEffect } from "react";
import { useBranch } from "../contexts/BranchContext";

const BranchSwitcher = () => {
  const {
    activeBranchId,
    activeBranch,
    userBranches,
    hasMultipleBranches,
    isGlobalRole,
    setActiveBranch,
  } = useBranch();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Single branch — static display
  if (!hasMultipleBranches) {
    return (
      <div className="hidden md:flex items-center gap-2 bg-primary/5 dark:bg-primary/10 px-3 py-1.5 rounded-full border border-primary/10 dark:border-primary/20">
        <span className="material-icons-round text-sm text-primary">store</span>
        <span className="text-sm font-medium text-primary">
          {activeBranch?.name || "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A"}
        </span>
      </div>
    );
  }

  // Multi-branch — dropdown
  const displayName =
    activeBranchId === 0
      ? "\u0643\u0644 \u0627\u0644\u0641\u0631\u0648\u0639"
      : activeBranch?.name || "\u0627\u062E\u062A\u0631 \u0641\u0631\u0639";

  return (
    <div className="relative hidden md:block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-primary/5 dark:bg-primary/10 px-3 py-1.5 rounded-full border border-primary/10 dark:border-primary/20 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors cursor-pointer"
      >
        <span className="material-icons-round text-sm text-primary">store</span>
        <span className="text-sm font-medium text-primary">{displayName}</span>
        <span className="material-icons-round text-sm text-primary">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-auto mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          {/* All Branches option for global roles */}
          {isGlobalRole && (
            <button
              onClick={() => {
                setActiveBranch(0);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                activeBranchId === 0
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              }`}
            >
              <span className="material-icons-round text-sm">language</span>
              <span>{"\u0643\u0644 \u0627\u0644\u0641\u0631\u0648\u0639"}</span>
            </button>
          )}

          {isGlobalRole && userBranches.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
          )}

          {userBranches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => {
                setActiveBranch(branch.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                activeBranchId === branch.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              }`}
            >
              <span className="material-icons-round text-sm">store</span>
              <span>{branch.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchSwitcher;
