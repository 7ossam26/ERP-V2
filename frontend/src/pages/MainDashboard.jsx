import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { getManagementModules, getCreationModules } from "../config/modules";
import ReorderAlertsWidget from "../components/common/ReorderAlertsWidget";
import Icon from "../components/ui/Icon";

const MainDashboardCard = ({ icon, title, subtitle, onClick }) => (
  <div
    onClick={onClick}
    className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-[10px] hover:shadow-soft dark:hover:shadow-soft-dark transition-all duration-300 cursor-pointer border border-line dark:border-line-dark group flex flex-col items-center text-center h-full hover:-translate-y-1 relative overflow-hidden min-h-touch"
  >
    <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    <div className="bg-accent-light dark:bg-accent-light-dark p-3 sm:p-4 rounded-full text-accent dark:text-accent-dark mb-3 sm:mb-4 group-hover:bg-accent group-hover:text-white transition-colors duration-300 relative z-10">
      <Icon name={icon} size={28} />
    </div>
    <h3 className="text-lg sm:text-xl font-bold text-ink dark:text-ink-dark mb-2 group-hover:text-accent transition-colors relative z-10">
      {title}
    </h3>
    <p className="text-sm text-muted dark:text-muted-dark relative z-10">
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
      <div className="text-center mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-ink dark:text-ink-dark mb-2">
          الصفحة الرئيسية
        </h2>
        <div className="h-1.5 w-24 bg-accent mx-auto rounded-full opacity-80"></div>
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
