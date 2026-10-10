import React from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { getCreationModules } from "../config/modules";
import ModuleCard from "../components/shared/ModuleCard";

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
        <h2 className="bm-gradient-text text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3">
          التكويدات
        </h2>
        <div className="h-1.5 w-24 bm-gradient mx-auto rounded-full"></div>
        <p className="mt-4 text-sm sm:text-base text-text-light/70 dark:text-text-dark/70 max-w-lg mx-auto px-4">
          إدارة البيانات الأساسية للنظام، بما في ذلك الموظفين، المخازن،
          والأصناف.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {cards
          .filter((card) => {
            if (!card.permission) return true;
            return AuthService.hasPermission(card.permission);
          })
          .map((card, index) => (
            <ModuleCard
              key={index}
              index={index}
              icon={card.icon}
              title={card.title}
              subtitle={card.description}
              onClick={card.onClick}
            />
          ))}
        <ModuleCard
          index={cards.length}
          icon="upload"
          title="استيراد وتصدير البيانات"
          subtitle="رفع وتحميل البيانات بصيغة Excel أو CSV"
          onClick={() => navigate("/data-import")}
        />
      </div>
    </div>
  );
};

export default CreatesDashboard;
