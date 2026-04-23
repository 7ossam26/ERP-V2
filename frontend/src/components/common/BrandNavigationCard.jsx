import React from "react";
import { Link } from "react-router-dom";
import { getCardColorVars } from "../../utils/cardPalette";

function CardRoot({ to, onClick, className, style, children }) {
  if (to) {
    return (
      <Link to={to} className={className} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}

export default function BrandNavigationCard({
  to,
  onClick,
  icon,
  title,
  description,
  seed,
  variant = "row",
  className = "",
  showArrow = true,
  iconStyle = "round",
  titleTag = "h3",
}) {
  const TitleTag = titleTag;
  const IconClass =
    iconStyle === "symbols" ? "material-symbols-outlined" : "material-icons-round";
  const resolvedSeed = seed || to || title || icon;

  const rootClasses = [
    "brand-card group relative w-full min-h-touch transition-all duration-300",
    variant === "center"
      ? "flex min-h-[11rem] flex-col items-center justify-center rounded-[1.75rem] px-5 py-6 text-center sm:min-h-[13rem] sm:px-7 sm:py-8"
      : "flex items-center gap-4 rounded-2xl p-4 text-right sm:p-5",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <CardRoot
      to={to}
      onClick={onClick}
      className={rootClasses}
      style={getCardColorVars(resolvedSeed)}>
      <div
        className={`brand-card-icon relative z-10 flex items-center justify-center rounded-2xl ${
          variant === "center"
            ? "mb-4 h-16 w-16 sm:mb-5 sm:h-20 sm:w-20"
            : "h-12 w-12 flex-shrink-0"
        }`}>
        <span
          className={`${IconClass} ${
            variant === "center" ? "text-3xl sm:text-4xl" : "text-2xl"
          }`}>
          {icon}
        </span>
      </div>

      {variant === "center" ? (
        <>
          <TitleTag className="brand-card-title relative z-10 text-lg font-bold sm:text-xl">
            {title}
          </TitleTag>
          {description ? (
            <p className="brand-card-subtitle relative z-10 mt-2 max-w-[18rem] text-sm">
              {description}
            </p>
          ) : null}
          {showArrow ? (
            <span className="brand-card-arrow material-icons-round pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-xl">
              arrow_downward
            </span>
          ) : null}
        </>
      ) : (
        <>
          <div className="relative z-10 min-w-0 flex-1 text-right">
            <TitleTag className="brand-card-title text-base font-bold sm:text-lg">
              {title}
            </TitleTag>
            {description ? (
              <p className="brand-card-subtitle mt-1 text-sm">{description}</p>
            ) : null}
          </div>
          {showArrow ? (
            <span className="brand-card-arrow material-icons-round relative z-10 mr-auto flex-shrink-0 text-xl">
              chevron_left
            </span>
          ) : null}
        </>
      )}
    </CardRoot>
  );
}
