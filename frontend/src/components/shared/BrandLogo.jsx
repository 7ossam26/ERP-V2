import React from "react";

export const BRAND_NAME = "BerryModa";

// BerryModa mark + wordmark. `size` scales the whole lockup; `inverted` is for
// dark backgrounds (e.g. the superadmin sidebar).
const SIZES = {
  sm: { mark: "h-8 w-8", word: "text-xl", tag: "text-[8px]" },
  md: { mark: "h-10 w-10 sm:h-11 sm:w-11", word: "text-2xl sm:text-[1.7rem]", tag: "text-[9px]" },
  lg: { mark: "h-16 w-16", word: "text-4xl", tag: "text-[11px]" },
};

const BrandLogo = ({ size = "md", inverted = false, showTagline = true, className = "" }) => {
  const s = SIZES[size] || SIZES.md;
  return (
    <span dir="ltr" className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <img
        src="/assets/berrymoda-mark.svg"
        alt=""
        aria-hidden="true"
        className={`${s.mark} shrink-0 drop-shadow-sm`}
      />
      <span className="flex flex-col leading-none">
        <span className={`font-brand font-bold tracking-tight ${s.word}`}>
          <span className={inverted ? "text-white" : "text-text-light dark:text-text-dark"}>
            Berry
          </span>
          <span className={`italic ${inverted ? "text-pink-300" : "text-primary"}`}>Moda</span>
        </span>
        {showTagline && (
          <span
            className={`${s.tag} font-bold uppercase tracking-[0.3em] mt-1 ${
              inverted ? "text-white/60" : "text-secondary"
            }`}>
            Fashion · Style
          </span>
        )}
      </span>
    </span>
  );
};

export default BrandLogo;
