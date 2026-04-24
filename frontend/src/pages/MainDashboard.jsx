import React from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { getManagementModules, getCreationModules } from "../config/modules";
import ReorderAlertsWidget from "../components/common/ReorderAlertsWidget";
import BrandNavigationCard from "../components/common/BrandNavigationCard";

const MainDashboard = () => {
  const navigate = useNavigate();

  const managementModules = getManagementModules();
  const creationModules = getCreationModules();

  const cards = [
    {
      icon: "qr_code_2",
      title: "تكويدات",
      subtitle: "إدارة الأصناف",
      onClick: () => navigate("/creates"),
      seed: "creates-home",
      isCreatesCard: true,
      creationPermissions: creationModules.map((module) => module.code),
    },
    ...managementModules.map((module) => ({
      icon: module.icon,
      title: module.label,
      subtitle: module.description,
      onClick: () => navigate(module.path),
      permission: module.code,
      seed: module.id,
    })),
  ];

  return (
    <div className="w-full max-w-5xl mx-auto relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-5 dark:opacity-5 hidden md:block">
        <span className="material-icons-round absolute top-10 left-10 text-9xl text-primary transform -rotate-12">
          local_cafe
        </span>
        <span className="material-icons-round absolute bottom-20 right-20 text-9xl text-primary transform rotate-12">
          coffee_maker
        </span>
      </div>

      <div className="text-center mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-light dark:text-text-dark mb-2">
          الصفحة الرئيسية
        </h2>
        <div className="h-1.5 w-24 bg-primary mx-auto rounded-full opacity-80"></div>
      </div>

      {AuthService.hasAnyPermission(["INVENTORY", "INVENTORY_COUNT"]) && (
        <div className="mb-6">
          <ReorderAlertsWidget />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {cards
          .filter((card) => {
            if (card.isCreatesCard) {
              return AuthService.hasAnyPermission(card.creationPermissions);
            }

            if (card.permission) {
              return AuthService.hasPermission(card.permission);
            }

            return true;
          })
          .map((card, index) => (
            <BrandNavigationCard
              key={index}
              variant="center"
              icon={card.icon}
              title={card.title}
              description={card.subtitle}
              onClick={card.onClick}
              seed={card.seed}
              showArrow={false}
              className="h-full"
            />
          ))}
      </div>
    </div>
  );
};

export default MainDashboard;
