import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import Footer from "../components/shared/Footer";
import BrandLogo from "../components/shared/BrandLogo";

const SuperadminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = AuthService.getCurrentUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await AuthService.logout();
    navigate("/");
  };

  const navItems = [
    { path: "/superadmin/users", icon: "people", label: "Users" },
    { path: "/superadmin/roles", icon: "badge", label: "Roles & Permissions" },
    { path: "/superadmin/audit-logs", icon: "history", label: "Audit Logs" },
    { path: "/superadmin/reset-database", icon: "delete_sweep", label: "Database Reset" },
  ];

  const SidebarContent = () => (
    <>
      <div className="h-16 sm:h-20 flex items-center px-4 sm:px-6 border-b border-white/10 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-3">
          <BrandLogo size="sm" inverted />
        </Link>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group min-h-touch ${
                isActive
                  ? "bm-gradient text-white shadow-glow"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}>
              <span
                className={`material-icons-round text-xl ${
                  isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                }`}>
                {item.icon}
              </span>
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3 px-3 mb-4">
          <div className="w-10 h-10 rounded-full bm-gradient flex items-center justify-center shrink-0">
            <span className="material-icons-round text-white">person</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{user?.name || "Admin"}</p>
            <p className="text-xs text-gray-400 truncate">@{user?.username || "admin"}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-sm font-medium min-h-touch">
          <span className="material-icons-round text-lg">logout</span>
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex font-body text-text-light dark:text-text-dark transition-colors duration-200">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible fixed; mobile: slide-over */}
      <aside className="w-64 bg-gray-950 text-white flex-col fixed inset-y-0 left-0 z-50 shadow-xl hidden lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      <aside
        className={`w-72 bg-gray-950 text-white flex-col fixed inset-y-0 left-0 z-50 shadow-2xl flex lg:hidden transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
        {/* Close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
          <span className="material-icons-round">close</span>
        </button>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark h-16 flex items-center px-4 sm:px-8 sticky top-0 z-40 gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-white hover:bg-primary/10 dark:hover:bg-gray-800 transition-colors">
            <span className="material-icons-round text-2xl">menu</span>
          </button>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-white transition-colors px-3 py-2 rounded-full hover:bg-primary/10 dark:hover:bg-gray-800">
            <span className="material-icons-round text-xl">arrow_forward</span>
            <span className="font-medium hidden sm:inline">رجوع</span>
          </button>
        </header>

        <div className="flex-grow p-4 sm:p-8 overflow-x-hidden">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default SuperadminLayout;
