/**
 * Text normalization for client-side search over Arabic content.
 *
 * `String.toLowerCase()` is a no-op for Arabic, so a plain `includes()` filter
 * misses the spelling variants users actually type: "طحينه" would not match
 * "طحينة", "احمد" would not match "أحمد". Every search box in the app filters an
 * already-loaded array, so normalizing both sides of the comparison is enough —
 * no backend or index changes needed.
 */

// Tashkeel (harakat) + tatweel: purely decorative, strip them.
const DIACRITICS = /[ً-ْٰـ]/g;

// Spelling variants users treat as interchangeable.
const CHAR_FOLDING = [
  [/[أإآٱ]/g, "ا"], // أ إ آ ٱ → ا
  [/ى/g, "ي"], // ى → ي
  [/ة/g, "ه"], // ة → ه
  [/ؤ/g, "و"], // ؤ → و
  [/ئ/g, "ي"], // ئ → ي
];

// Arabic-Indic digits → ASCII, so "٢٥" matches "25" in item names.
const ARABIC_INDIC_ZERO = 0x0660;
const DIGITS = /[٠-٩]/g;

/**
 * Folds a string into a comparable form: lowercased, diacritic-free, with
 * interchangeable Arabic letters and digits unified and whitespace collapsed.
 *
 * @param {unknown} value
 * @returns {string} normalized text, or "" for null/undefined/non-strings
 */
export const normalizeArabic = (value) => {
  if (value === null || value === undefined) return "";

  let text = String(value).toLowerCase().replace(DIACRITICS, "");

  for (const [pattern, replacement] of CHAR_FOLDING) {
    text = text.replace(pattern, replacement);
  }

  return text
    .replace(DIGITS, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * True when `haystack` contains `normalizedNeedle`, comparing normalized forms.
 * Pass a needle that is ALREADY normalized so a filter loop normalizes the
 * user's query once instead of once per row.
 *
 * @param {unknown} haystack        raw candidate value
 * @param {string}  normalizedNeedle output of normalizeArabic(query)
 * @returns {boolean}
 */
export const matchesNormalized = (haystack, normalizedNeedle) => {
  if (!normalizedNeedle) return true;
  return normalizeArabic(haystack).includes(normalizedNeedle);
};
