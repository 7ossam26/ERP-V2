import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { getManagementModules, getCreationModules } from "../config/modules";
import ReorderAlertsWidget from "../components/common/ReorderAlertsWidget";

const MainDashboardCard = ({ icon, title, subtitle, onClick }) => (
  <div
    onClick={onClick}
    className="bg-surface-light dark:bg-surface-dark p-4 sm:p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-border-light dark:border-border-dark group flex flex-col items-center text-center h-full hover:-translate-y-1 relative overflow-hidden min-h-touch"
  >
    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    <div className="bg-primary/10 dark:bg-primary/20 p-3 sm:p-4 rounded-full text-primary mb-3 sm:mb-4 group-hover:bg-primary group-hover:text-white transition-colors duration-300 relative z-10">
      <span className="material-icons-round text-2xl sm:text-3xl">{icon}</span>
    </div>
    <h3 className="text-lg sm:text-xl font-bold text-text-light dark:text-text-dark mb-2 group-hover:text-primary transition-colors relative z-10">
      {title}
    </h3>
    <p className="text-sm text-text-light/60 dark:text-text-dark/60 relative z-10">
      {subtitle}
    </p>
  </div>
);

const MainDashboard = () => {
  const navigate = useNavigate();

  // Load modules from config
  const managementModules = getManagementModules();
  const creationModules = getCreationModules();

  // Transform config modules to dashboard card format
  const cards = [
    // Special "Creates" Card
    {
      icon: "qr_code_2",
      title: "تكويدات",
      subtitle: "إدارة الأصناف",
      onClick: () => navigate("/creates"),
      // Special logic: Show if user has ANY creation permission
      isCreatesCard: true,
      creationPermissions: creationModules.map(m => m.code)
    },
    // Standard Management Cards
    ...managementModules.map(m => ({
      icon: m.icon,
      title: m.label,
      subtitle: m.description,
      onClick: () => navigate(m.path),
      permission: m.code
    }))
  ];

  return (
    <div className="w-full max-w-5xl mx-auto relative">
      {/* Background Decoration - Hidden on mobile */}
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

      {/* Reorder Alerts Widget */}
      {AuthService.hasAnyPermission(["INVENTORY", "INVENTORY_COUNT"]) && (
        <div className="mb-6">
          <ReorderAlertsWidget />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {cards.filter(card => {
          if (card.isCreatesCard) {
            return AuthService.hasAnyPermission(card.creationPermissions);
          }
          if (card.permission) {
            return AuthService.hasPermission(card.permission);
          }
          return true;
        }).map((card, index) => (
          <MainDashboardCard key={index} {...card} />
        ))}
      </div>
    </div>
  );
};

export default MainDashboard;
