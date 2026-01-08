import React from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../services/authService";

const MainLayout = ({ children }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await AuthService.logout();
    navigate("/");
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body transition-colors duration-300 min-h-screen flex flex-col relative overflow-hidden">
      {/* Navigation */}
      <nav className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark shadow-sm z-50 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-xl text-primary">
                <span className="material-icons-round text-3xl">coffee</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary dark:text-text-dark leading-tight">
                  بن الغنيمي
                </h1>
                <p className="text-xs text-primary/80 font-semibold tracking-wide uppercase">
                  Elghonemy
                </p>
              </div>
            </div>
            <Link
              className="flex items-center gap-2 text-text-light/70 hover:text-primary dark:text-text-dark/70 dark:hover:text-primary transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-accent/10 dark:hover:bg-accent/5"
              to="/dashboard">
              <span className="text-sm font-semibold">الصفحة الرئيسية</span>
              <span className="material-icons-round text-xl transform rotate-180">
                arrow_back
              </span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-text-light/70 hover:text-red-600 dark:text-text-dark/70 dark:hover:text-red-400 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 ml-2"
            >
              <span className="text-sm font-semibold">تسجيل خروج</span>
              <span className="material-icons-round text-xl">logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex flex-col p-6 transition-all duration-300">
        <div className="w-full max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark py-6 blur-sm">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-text-light/60 dark:text-text-dark/60">
            © 2023 <span className="font-bold text-primary">بن الغنيمي</span>.
            جميع الحقوق محفوظة.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
