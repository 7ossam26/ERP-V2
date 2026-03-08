import React from "react";
import { Link } from "react-router-dom";

const ReportsPage = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark min-h-[calc(100vh-6rem)] flex flex-col transition-colors duration-300">
      <main className="flex-grow flex flex-col items-center justify-center p-6 sm:p-10 relative overflow-hidden">
        {/* Background Icons */}
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
            {/* General Report Card */}
            <Link
              to="/reports/general"
              className="group relative bg-surface-light dark:bg-surface-dark rounded-3xl p-8 shadow-soft hover:shadow-hover border border-transparent hover:border-primary/20 transition-all duration-300 flex flex-col items-center justify-center text-center h-64 md:h-72 w-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 mb-6 transform group-hover:scale-110 transition-transform duration-300">
                <div className="h-24 w-24 bg-accent/20 dark:bg-primary/20 text-primary dark:text-accent rounded-full flex items-center justify-center shadow-lg group-hover:shadow-glow group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <span className="material-symbols-outlined text-5xl">
                    summarize
                  </span>
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-text-light dark:text-text-dark mb-2 group-hover:text-primary dark:group-hover:text-accent transition-colors">
                  تقارير
                </h3>
                <p className="text-sm text-text-light/60 dark:text-text-dark/60 group-hover:text-text-light/80 dark:group-hover:text-text-dark/80 transition-colors">
                  ملخص شامل للمبيعات والأرباح والمخزون
                </p>
              </div>
              <div className="absolute bottom-4 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 text-primary dark:text-accent">
                <span className="material-symbols-outlined text-2xl">
                  arrow_downward
                </span>
              </div>
            </Link>

            {/* Detailed Report Card */}
            <Link
              to="/reports/detailed"
              className="group relative bg-surface-light dark:bg-surface-dark rounded-3xl p-8 shadow-soft hover:shadow-hover border border-transparent hover:border-primary/20 transition-all duration-300 flex flex-col items-center justify-center text-center h-64 md:h-72 w-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-bl from-accent/10 to-transparent dark:from-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 mb-6 transform group-hover:scale-110 transition-transform duration-300">
                <div className="h-24 w-24 bg-accent/20 dark:bg-primary/20 text-primary dark:text-accent rounded-full flex items-center justify-center shadow-lg group-hover:shadow-glow group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <span className="material-symbols-outlined text-5xl">
                    table_view
                  </span>
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-text-light dark:text-text-dark mb-2 group-hover:text-primary dark:group-hover:text-accent transition-colors">
                  السجلات
                </h3>
                <p className="text-sm text-text-light/60 dark:text-text-dark/60 group-hover:text-text-light/80 dark:group-hover:text-text-dark/80 transition-colors">
                  عرض التفاصيل الكاملة والفلترة حسب التاريخ والصنف
                </p>
              </div>
              <div className="absolute bottom-4 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 text-primary dark:text-accent">
                <span className="material-symbols-outlined text-2xl">
                  arrow_downward
                </span>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;
