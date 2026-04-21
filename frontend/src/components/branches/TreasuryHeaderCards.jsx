import React from "react";

const fmt = (n) => Number(n || 0).toLocaleString();

const TreasuryHeaderCards = ({
  mainTreasury,
  visaTreasury,
  instapayTreasury,
  branchesTotalBalance = 0,
  percentageChange = 0,
  isPositive = true,
}) => {
  const mainTotal = Number(mainTreasury?.balance || 0) + Number(branchesTotalBalance || 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Main Treasury + Branches */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4A3428] to-[#6F4E37] text-white p-6 shadow-lg">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#d7ccc8 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center gap-2 bg-white/5 w-fit px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span className="text-xs font-bold uppercase tracking-wider text-white/90">
              {mainTreasury?.name || "الخزينة الرئيسية"} + الفروع
            </span>
          </div>
          <div>
            <p className="text-white/60 text-xs mb-1">الرصيد الإجمالي الحالي</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              {fmt(mainTotal)}
              <span className="text-sm font-normal text-white/70 mr-2">ج.م</span>
            </h2>
          </div>
          <div
            className={`flex items-center gap-2 w-fit ${
              isPositive
                ? "text-green-300 bg-green-400/10 border-green-400/20"
                : "text-red-300 bg-red-400/10 border-red-400/20"
            } px-3 py-1 rounded-lg border`}>
            <span className="material-symbols-outlined text-[16px]">
              {isPositive ? "trending_up" : "trending_down"}
            </span>
            <span className="text-xs font-bold">
              {isPositive ? "+" : "-"}
              {percentageChange}%
            </span>
            <span className="text-xs text-white/70">مقارنة بالأمس</span>
          </div>
        </div>
      </div>

      {/* Visa Treasury */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#1e3a8a] text-white p-6 shadow-lg">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#93c5fd 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
            <span className="material-symbols-outlined text-[18px]">credit_card</span>
            <span className="text-xs font-bold uppercase tracking-wider text-white/90">
              {visaTreasury?.name || "خزينة فيزا"}
            </span>
          </div>
          <div>
            <p className="text-white/60 text-xs mb-1">الرصيد المتراكم</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              {fmt(visaTreasury?.balance)}
              <span className="text-sm font-normal text-white/70 mr-2">ج.م</span>
            </h2>
          </div>
          {!visaTreasury && (
            <p className="text-xs text-white/70">لم يتم ضبط خزينة الفيزا</p>
          )}
        </div>
      </div>

      {/* Instapay Treasury */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#4c1d95] text-white p-6 shadow-lg">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#c4b5fd 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
            <span className="material-symbols-outlined text-[18px]">
              account_balance_wallet
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-white/90">
              {instapayTreasury?.name || "خزينة انستاباي"}
            </span>
          </div>
          <div>
            <p className="text-white/60 text-xs mb-1">الرصيد المتراكم</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              {fmt(instapayTreasury?.balance)}
              <span className="text-sm font-normal text-white/70 mr-2">ج.م</span>
            </h2>
          </div>
          {!instapayTreasury && (
            <p className="text-xs text-white/70">لم يتم ضبط خزينة انستاباي</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TreasuryHeaderCards;
