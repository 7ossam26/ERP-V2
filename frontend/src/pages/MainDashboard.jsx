import React from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import { getManagementModules, getCreationModules } from "../config/modules";
import ModuleCard from "../components/shared/ModuleCard";

const MainDashboard = () => {
  const navigate = useNavigate();
  const user = AuthService.getCurrentUser();
  const today = new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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

  const visibleCards = cards.filter(card => {
    if (card.isCreatesCard) {
      return AuthService.hasAnyPermission(card.creationPermissions);
    }
    if (card.permission) {
      return AuthService.hasPermission(card.permission);
    }
    return true;
  });

  return (
    <div className="w-full max-w-6xl mx-auto relative">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-3xl bm-gradient text-white shadow-glow mb-8 sm:mb-10 px-6 py-7 sm:px-10 sm:py-10">
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute -bottom-16 left-1/3 w-56 h-56 rounded-full bg-coral/30 blur-2xl" aria-hidden="true" />
        <span
          className="material-icons-round absolute left-6 sm:left-12 top-1/2 -translate-y-1/2 text-white/20 -rotate-12 hidden sm:block"
          style={{ fontSize: "9rem" }}
          aria-hidden="true">
          checkroom
        </span>
        <div className="relative">
          <p className="text-white/75 text-sm font-semibold mb-1">{today}</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2">
            الصفحة الرئيسية
          </h2>
          <p className="text-white/85 text-sm sm:text-base">
            {user?.name ? `أهلاً ${user.name}، ` : "أهلاً بك، "}
            مرحباً بك في لوحة تحكم BerryModa
          </p>
        </div>
      </section>

      <div className="flex items-center gap-3 mb-4 sm:mb-5">
        <span className="h-6 w-1.5 rounded-full bm-gradient" />
        <h3 className="text-lg sm:text-xl font-bold text-text-light dark:text-text-dark">
          الأقسام
        </h3>
        <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
          {visibleCards.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {visibleCards.map((card, index) => (
          <ModuleCard
            key={index}
            index={index}
            icon={card.icon}
            title={card.title}
            subtitle={card.subtitle}
            onClick={card.onClick}
          />
        ))}
      </div>
    </div>
  );
};

export default MainDashboard;
