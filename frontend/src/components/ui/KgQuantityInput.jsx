import React from "react";

/**
 * Unit-aware quantity input used system-wide.
 *
 * - kg items  → free decimal input (step any) with ك badge
 * - piece/box → integer input (step 1) with قطعة / علبة badge
 *
 * @param {number}   value    – current quantity in base unit (kg or count)
 * @param {function} onChange – called with new numeric value
 * @param {string}   unit     – "kg" | "piece" | "box" | any string
 * @param {number}   [min=0]  – minimum allowed value
 * @param {string}   [className] – extra classes forwarded to inputs
 */
const KgQuantityInput = ({ value, onChange, unit, min = 0, className = "" }) => {
  const isKg = unit === "kg";

  const inputCls =
    `border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-background-dark ` +
    `text-text-light dark:text-text-dark text-center focus:ring-1 focus:ring-primary ` +
    `focus:border-primary px-1.5 py-1.5 text-sm font-bold w-20 ${className}`;

  const badge = (color = "primary") =>
    `text-xs font-bold text-white rounded px-1.5 py-0.5 shrink-0 ${
      color === "green"
        ? "bg-green-600 dark:bg-green-700"
        : "bg-primary dark:bg-primary"
    }`;

  if (isKg) {
    return (
      <div className="flex items-center gap-1.5 justify-center">
        <input
          type="number"
          min={min}
          step="any"
          value={parseFloat(value) || 0}
          onChange={(e) =>
            onChange(Math.max(min, parseFloat(e.target.value) || 0))
          }
          className={inputCls}
          placeholder="0.0"
        />
        <span className={badge()}>ك</span>
      </div>
    );
  }

  /* ── Piece / Box mode ────────────────────────────────── */
  const label = unit === "box" ? "علبة" : "قطعة";
  return (
    <div className="flex items-center gap-1.5 justify-center">
      <input
        type="number"
        min={min}
        step="1"
        value={Math.max(0, parseInt(value) || 0)}
        onChange={(e) =>
          onChange(Math.max(min, parseInt(e.target.value) || 0))
        }
        className={inputCls}
      />
      <span className={badge()}>{label}</span>
    </div>
  );
};

export default KgQuantityInput;
