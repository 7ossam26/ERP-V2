import React from "react";

const fmt = (n) =>
  Number(n || 0).toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── HQ context strip ────────────────────────────────────────────────────────
// Slim, low-weight bar. The HQ vault is reference data, not a daily operational
// metric — it sits visually above the scoreboard, not next to it.

function HQContextStrip({ mainTreasury, loading }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-l from-[#4A3428]/95 to-[#6F4E37]/95 text-white shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-[18px] text-white/80">lock</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/80 truncate">
          {mainTreasury?.name || "الخزينة الرئيسية"}
        </span>
        <span className="text-[10px] text-white/60 font-medium">— الرصيد الحالي</span>
      </div>
      <div className="flex items-baseline gap-1 flex-shrink-0">
        {loading ? (
          <span className="h-4 w-20 bg-white/20 rounded animate-pulse" />
        ) : (
          <>
            <span className="font-black text-base text-white tabular-nums">
              {fmt(mainTreasury?.balance)}
            </span>
            <span className="text-[10px] text-white/70 font-medium">ج.م</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── single header card ──────────────────────────────────────────────────────
// Each card is captioned with its time domain so stock/flow is unambiguous.

function HeaderCard({ icon, label, timeDomain, value, loading, accent }) {
  // accent: { from, to, dot, ring } classes for the gradient + dot
  return (
    <div className={`relative overflow-hidden rounded-2xl ${accent.bg} border ${accent.border} p-5 shadow-sm`}>
      {/* Top row: icon + label */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0`}>
            <span className={`material-symbols-outlined text-[20px] ${accent.iconColor}`}>{icon}</span>
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm text-text-light dark:text-text-dark truncate leading-tight">{label}</p>
            <p className={`text-[10px] font-black uppercase tracking-wider mt-0.5 ${accent.captionColor}`}>
              {timeDomain}
            </p>
          </div>
        </div>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        {loading ? (
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <>
            <p className={`font-black text-3xl tabular-nums ${accent.valueColor}`}>{fmt(value)}</p>
            <span className="text-xs font-medium text-text-light/50 dark:text-text-dark/40">ج.م</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── trend pill ──────────────────────────────────────────────────────────────
// Caption names the comparison window so the figure is never ambiguous.

function TrendPill({ percentageChange, isPositive, caption }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs ${
        isPositive
          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
          : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">
        {isPositive ? "trending_up" : "trending_down"}
      </span>
      <span className="font-black tabular-nums">
        {isPositive ? "+" : "−"}
        {percentageChange}%
      </span>
      <span className="text-[10px] opacity-70 font-medium">
        {caption || "اليوم vs الأمس"}
      </span>
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

const ACCENTS = {
  cash: {
    bg: "bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-card-dark",
    border: "border-emerald-200/60 dark:border-emerald-900/40",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-700 dark:text-emerald-400",
    valueColor: "text-emerald-700 dark:text-emerald-400",
    captionColor: "text-emerald-700/70 dark:text-emerald-400/70",
  },
  visa: {
    bg: "bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-card-dark",
    border: "border-blue-200/60 dark:border-blue-900/40",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-700 dark:text-blue-400",
    valueColor: "text-blue-700 dark:text-blue-400",
    captionColor: "text-blue-700/70 dark:text-blue-400/70",
  },
  instapay: {
    bg: "bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-card-dark",
    border: "border-purple-200/60 dark:border-purple-900/40",
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-700 dark:text-purple-400",
    valueColor: "text-purple-700 dark:text-purple-400",
    captionColor: "text-purple-700/70 dark:text-purple-400/70",
  },
};

const TreasuryHeaderCards = ({
  mainTreasury,
  branchesCashTotal = 0,
  windowVisaSales = 0,
  windowInstapaySales = 0,
  windowLabel = "للفترة",
  percentageChange = 0,
  isPositive = true,
  trendCaption,
  loading = false,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* HQ context strip — separate visual layer above the scoreboard */}
      <HQContextStrip mainTreasury={mainTreasury} loading={loading} />

      {/* 3-up scoreboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HeaderCard
          icon="payments"
          label="نقدية الفروع"
          timeDomain="الآن · الرصيد الحالي"
          value={branchesCashTotal}
          loading={loading}
          accent={ACCENTS.cash}
        />
        <HeaderCard
          icon="credit_card"
          label="مبيعات فيزا"
          timeDomain={windowLabel}
          value={windowVisaSales}
          loading={loading}
          accent={ACCENTS.visa}
        />
        <HeaderCard
          icon="qr_code_2"
          label="مبيعات انستاباي"
          timeDomain={windowLabel}
          value={windowInstapaySales}
          loading={loading}
          accent={ACCENTS.instapay}
        />
      </div>

      {/* Trend — compares the selected window against the one before it */}
      {!loading && (
        <div className="flex items-center justify-end pt-1">
          <TrendPill
            percentageChange={percentageChange}
            isPositive={isPositive}
            caption={trendCaption}
          />
        </div>
      )}
    </div>
  );
};

export default TreasuryHeaderCards;
