import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import Footer from "../components/shared/Footer";

const SuperadminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = AuthService.getCurrentUser();

  const handleLogout = async () => {
    await AuthService.logout();
    navigate("/");
  };

  const navItems = [
    { path: "/superadmin/users", icon: "people", label: "Users" },
    { path: "/superadmin/roles", icon: "badge", label: "Roles & Permissions" },
    { path: "/superadmin/audit-logs", icon: "history", label: "Audit Logs" },
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar - Hidden on mobile, visible on larger screens */}
      <aside className="w-64 bg-slate-900 text-white flex-col fixed inset-y-0 left-0 z-50 shadow-xl hidden lg:flex">
        <div className="h-16 sm:h-20 flex items-center px-4 sm:px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src="/assets/logo.png"
              alt="Elghonemy Logo"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group min-h-touch ${isActive
                  ? "bg-red-600 text-white shadow-lg shadow-red-900/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}>
                <span
                  className={`material-icons-round text-xl ${isActive
                    ? "text-white"
                    : "text-slate-400 group-hover:text-white"
                    }`}>
                  {item.icon}
                </span>
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
              <span className="material-icons-round text-slate-400">
                person
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">
                {user?.name || "Admin"}
              </p>
              <p className="text-xs text-slate-500 truncate">
                @{user?.username || "admin"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-sm font-medium min-h-touch">
            <span className="material-icons-round text-lg">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content - Full width on mobile, margin for sidebar on desktop */}
      <main className="flex-1 lg:ml-64 flex flex-col">
        <div className="flex-grow p-4 sm:p-8">
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
