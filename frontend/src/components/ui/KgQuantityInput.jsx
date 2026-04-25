import React from "react";

/**
 * Unit-aware quantity input used system-wide.
 *
 * - decimal units (kg/cm/meter) → decimal input (step 0.001)
 * - integer units (piece/box)   → integer input (step 1)
 *
 * @param {number}   value    – current quantity in base unit (kg or count)
 * @param {function} onChange – called with new numeric value
 * @param {string}   unit     – unit key (kg | cm | m | piece | box | ...)
 * @param {number}   [min=0]  – minimum allowed value
 * @param {string}   [className] – extra classes forwarded to inputs
 * @param {boolean}  [allowUnitChange=false] – render inline unit selector
 * @param {Array<{value:string,label:string}>} [unitOptions=[]] – options for selector
 * @param {function} [onUnitChange] – called when unit selector changes
 */
const KgQuantityInput = ({
  value,
  onChange,
  unit,
  min = 0,
  className = "",
  allowUnitChange = false,
  unitOptions = [],
  onUnitChange,
}) => {
  const normalizedUnit = String(unit || "").toLowerCase();
  const decimalUnits = new Set(["kg", "kilo", "kilogram", "cm", "centimeter", "centimetre", "m", "meter", "metre"]);
  const isDecimalUnit = decimalUnits.has(normalizedUnit);

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

  const unitLabelMap = {
    kg: "كجم",
    kilo: "كجم",
    kilogram: "كجم",
    cm: "سم",
    centimeter: "سم",
    centimetre: "سم",
    m: "م",
    meter: "م",
    metre: "م",
    piece: "قطعة",
    box: "علبة",
  };
  const unitLabel = unitLabelMap[normalizedUnit] || unit || "قطعة";

  if (isDecimalUnit) {
    return (
      <div className="flex items-center gap-1.5 justify-center">
        <input
          type="number"
          min={min}
          step="0.001"
          value={parseFloat(value) || 0}
          onChange={(e) =>
            onChange(Math.max(min, parseFloat(e.target.value) || 0))
          }
          className={inputCls}
          placeholder="0.000"
        />
        {allowUnitChange && unitOptions.length > 0 ? (
          <select
            value={unit}
            onChange={(e) => onUnitChange?.(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-background-dark text-text-light dark:text-text-dark px-1.5 py-1.5 text-xs font-bold"
          >
            {unitOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <span className={badge()}>{unitLabel}</span>
        )}
      </div>
    );
  }

  /* ── Integer units mode ────────────────────────────────── */
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
      {allowUnitChange && unitOptions.length > 0 ? (
        <select
          value={unit}
          onChange={(e) => onUnitChange?.(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-background-dark text-text-light dark:text-text-dark px-1.5 py-1.5 text-xs font-bold"
        >
          {unitOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <span className={badge()}>{unitLabel}</span>
      )}
    </div>
  );
};

export default KgQuantityInput;
