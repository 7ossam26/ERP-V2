import React from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { getCreationModules } from "../config/modules";

const DashboardCard = ({ icon, title, description, onClick }) => (
  <div
    onClick={onClick}
    className="group relative flex flex-col items-center justify-center w-full h-40 sm:h-48 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-soft dark:shadow-soft-dark border border-transparent hover:border-primary/20 transition-all duration-300 cursor-pointer hover:-translate-y-1 p-4 min-h-touch">
    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-accent/20 dark:bg-accent/10 text-primary dark:text-accent flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
      <span className="material-icons-round text-3xl sm:text-4xl">{icon}</span>
    </div>
    <h3 className="text-lg sm:text-xl font-bold text-text-light dark:text-text-dark group-hover:text-primary transition-colors">
      {title}
    </h3>
    <p className="text-xs text-text-light/50 dark:text-text-dark/50 mt-1">
      {description}
    </p>
  </div>
);

const CreatesDashboard = () => {
  const navigate = useNavigate();
  const creationModules = getCreationModules();

  const cards = creationModules.map((m) => ({
    icon: m.icon,
    title: m.label,
    description: m.description,
    onClick: () => navigate(m.path),
    permission: m.code,
  }));

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-center mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-primary dark:text-text-dark mb-2">
          التكويدات
        </h2>
        <div className="h-1.5 w-24 bg-primary mx-auto rounded-full opacity-80"></div>
        <p className="mt-4 text-sm sm:text-base text-text-light/70 dark:text-text-dark/70 max-w-lg mx-auto px-4">
          إدارة البيانات الأساسية للنظام، بما في ذلك الموظفين، المخازن،
          والأصناف.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {cards
          .filter((card) => {
            if (!card.permission) return true;
            return AuthService.hasPermission(card.permission);
          })
          .map((card, index) => (
            <DashboardCard key={index} {...card} />
          ))}
        <DashboardCard
          icon="upload"
          title="استيراد وتصدير البيانات"
          description="رفع وتحميل البيانات بصيغة Excel أو CSV"
          onClick={() => navigate("/data-import")}
        />
      </div>
    </div>
  );
};

export default CreatesDashboard;
