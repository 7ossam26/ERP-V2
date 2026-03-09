import React from "react";

/**
 * Unit-aware quantity input used system-wide.
 *
 * - kg items  → [kg integer] ك  [0-999 grams] جم
 * - piece/box → [integer]  قطعة / علبة
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
    `focus:border-primary px-1.5 py-1.5 text-sm font-bold w-14 ${className}`;

  const badge = (color = "primary") =>
    `text-xs font-bold text-white rounded px-1.5 py-0.5 shrink-0 ${
      color === "green"
        ? "bg-green-600 dark:bg-green-700"
        : "bg-primary dark:bg-primary"
    }`;

  /* ── Piece / Box mode ────────────────────────────────── */
  if (!isKg) {
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
  }

  /* ── Kilogram mode: split into kg (integer) + grams (0–999) ─── */
  const numVal = parseFloat(value) || 0;
  const kgPart = Math.floor(numVal);
  const gmPart = Math.round((numVal - kgPart) * 1000);

  const handleKgChange = (e) => {
    const newKg = Math.max(0, parseInt(e.target.value) || 0);
    onChange(parseFloat((newKg + gmPart / 1000).toFixed(3)));
  };

  const handleGmChange = (e) => {
    const newGm = Math.min(999, Math.max(0, parseInt(e.target.value) || 0));
    onChange(parseFloat((kgPart + newGm / 1000).toFixed(3)));
  };

  return (
    <div className="flex items-center gap-1 justify-center">
      <input
        type="number"
        min={0}
        step="1"
        value={kgPart}
        onChange={handleKgChange}
        className={inputCls}
        placeholder="0"
      />
      <span className={badge()}>ك</span>
      <input
        type="number"
        min={0}
        max={999}
        step="1"
        value={gmPart}
        onChange={handleGmChange}
        className={inputCls}
        placeholder="0"
      />
      <span className={badge("green")}>جم</span>
    </div>
  );
};

export default KgQuantityInput;
