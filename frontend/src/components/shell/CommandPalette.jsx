import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../ui/Icon";
import AuthService from "../../services/authService";
import { MODULES } from "../../config/modules";

/**
 * Command Palette — Ctrl+K / Cmd+K
 * Pure navigation: searches modules, no data mutations.
 */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  // Filter modules by permission
  const allModules = useMemo(() => {
    return MODULES.filter((m) => {
      if (!m.code) return true;
      return AuthService.hasPermission(m.code);
    });
  }, []);

  // Fuzzy search
  const results = useMemo(() => {
    if (!query.trim()) return allModules.slice(0, 12);
    const q = query.toLowerCase();
    return allModules
      .filter(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.path.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, allModules]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[activeIdx]) {
        e.preventDefault();
        navigate(results[activeIdx].path);
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, activeIdx, results, navigate, onClose]);

  // Clamp active index
  useEffect(() => {
    if (activeIdx >= results.length) setActiveIdx(Math.max(0, results.length - 1));
  }, [results, activeIdx]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-surface dark:bg-surface-dark rounded-lg border border-line dark:border-line-dark shadow-lg overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line dark:border-line-dark">
          <Icon name="search" size={20} className="text-muted dark:text-muted-dark flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="ابحث عن صفحة أو وظيفة..."
            className="flex-1 bg-transparent text-ink dark:text-ink-dark placeholder-muted outline-none text-sm"
            dir="rtl"
          />
          <kbd className="text-[11px] border border-line dark:border-line-dark rounded px-1.5 py-0.5 font-mono text-muted">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted dark:text-muted-dark">
              لا توجد نتائج
            </p>
          ) : (
            results.map((mod, idx) => (
              <button
                key={mod.id}
                onClick={() => { navigate(mod.path); onClose(); }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors ${
                  idx === activeIdx
                    ? "bg-accent-light dark:bg-accent-light-dark text-accent dark:text-accent-dark"
                    : "text-ink dark:text-ink-dark hover:bg-canvas dark:hover:bg-canvas-dark"
                }`}
              >
                <Icon name={mod.icon} size={18} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{mod.label}</div>
                  <div className="text-[11px] text-muted dark:text-muted-dark truncate">
                    {mod.description}
                  </div>
                </div>
                {idx === activeIdx && (
                  <Icon name="arrow_back" size={14} className="mr-auto text-muted" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
