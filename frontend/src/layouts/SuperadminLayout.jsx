import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import Footer from "../components/shared/Footer";

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
    { path: "/dashboard", icon: "dashboard", label: "Dashboard", exact: true },
    { path: "/superadmin/users", icon: "people", label: "Users" },
    { path: "/superadmin/roles", icon: "badge", label: "Roles & Permissions" },
    { path: "/superadmin/audit-logs", icon: "history", label: "Audit Logs" },
    { path: "/superadmin/reset-database", icon: "delete_sweep", label: "Database Reset" },
  ];

  const SidebarContent = () => (
    <>
      <div className="h-16 sm:h-20 flex items-center px-4 sm:px-6 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/assets/logo.png"
            alt="Elghonemy Logo"
            className="h-10 sm:h-12 w-auto object-contain"
          />
        </div>
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
                  ? "bg-red-600 text-white shadow-lg shadow-red-900/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}>
              <span
                className={`material-icons-round text-xl ${
                  isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                }`}>
                {item.icon}
              </span>
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-3 px-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
            <span className="material-icons-round text-slate-400">person</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{user?.name || "Admin"}</p>
            <p className="text-xs text-slate-500 truncate">@{user?.username || "admin"}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-sm font-medium min-h-touch">
          <span className="material-icons-round text-lg">logout</span>
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible fixed; mobile: slide-over */}
      <aside className="w-64 bg-slate-900 text-white flex-col fixed inset-y-0 left-0 z-50 shadow-xl hidden lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      <aside
        className={`w-72 bg-slate-900 text-white flex-col fixed inset-y-0 left-0 z-50 shadow-2xl flex lg:hidden transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
        {/* Close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
          <span className="material-icons-round">close</span>
        </button>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 flex items-center px-4 sm:px-8 sticky top-0 z-40 gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span className="material-icons-round text-2xl">menu</span>
          </button>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
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
