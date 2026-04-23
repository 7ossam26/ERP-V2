import React from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { getCreationModules } from "../config/modules";
import BrandNavigationCard from "../components/common/BrandNavigationCard";

const CreatesDashboard = () => {
  const navigate = useNavigate();
  const creationModules = getCreationModules();

  const cards = creationModules.map((module) => ({
    icon: module.icon,
    title: module.label,
    description: module.description,
    onClick: () => navigate(module.path),
    permission: module.code,
    seed: module.id,
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
            if (!card.permission) {
              return true;
            }

            return AuthService.hasPermission(card.permission);
          })
          .map((card, index) => (
            <BrandNavigationCard
              key={index}
              variant="center"
              icon={card.icon}
              title={card.title}
              description={card.description}
              onClick={card.onClick}
              seed={card.seed}
              showArrow={false}
              className="h-full"
            />
          ))}
        <BrandNavigationCard
          icon="upload"
          title="استيراد البيانات"
          description="رفع بيانات جماعية من Excel أو CSV"
          onClick={() => navigate("/data-import")}
          variant="center"
          seed="data-import"
          showArrow={false}
          className="h-full"
        />
      </div>
    </div>
  );
};

export default CreatesDashboard;
