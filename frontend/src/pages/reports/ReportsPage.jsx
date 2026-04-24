import React from "react";
import BrandNavigationCard from "../../components/common/BrandNavigationCard";

const ReportsPage = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark min-h-[calc(100vh-6rem)] flex flex-col transition-colors duration-300">
      <main className="flex-grow flex flex-col items-center justify-center p-6 sm:p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-5 dark:opacity-5">
          <span className="material-symbols-outlined absolute top-10 left-10 text-9xl text-primary transform -rotate-12">
            analytics
          </span>
          <span className="material-symbols-outlined absolute bottom-20 right-20 text-9xl text-primary transform rotate-12">
            pie_chart
          </span>
        </div>

        <div className="w-full max-w-4xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-accent">
              <span className="material-symbols-outlined text-4xl">
                bar_chart
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-text-light dark:text-text-dark mb-3">
              التقارير والسجلات
            </h2>
            <div className="h-1.5 w-32 bg-primary mx-auto rounded-full mb-4 shadow-sm"></div>
            <p className="text-text-light/70 dark:text-text-dark/70 max-w-lg mx-auto text-lg">
              اختر نوع التقرير الذي تود استعراضه من الخيارات المتاحة أدناه
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <BrandNavigationCard
              to="/reports/general"
              variant="center"
              icon="summarize"
              iconStyle="symbols"
              title="تقارير"
              description="ملخص شامل للمبيعات والأرباح والمخزون"
              seed="reports-general"
              className="h-64 md:h-72"
            />
            <BrandNavigationCard
              to="/reports/detailed"
              variant="center"
              icon="table_view"
              iconStyle="symbols"
              title="السجلات"
              description="عرض التفاصيل الكاملة والفلترة حسب التاريخ والصنف"
              seed="reports-detailed"
              className="h-64 md:h-72"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;
