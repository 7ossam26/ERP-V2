import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../services/authService";
import Modal from "../components/ui/Modal";

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    await AuthService.logout();
    setIsLogoutModalOpen(false);
    navigate("/");
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body transition-colors duration-300 min-h-screen flex flex-col relative overflow-hidden">
      {/* Navigation */}
      <nav className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark shadow-sm z-50 fixed top-0 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center relative">
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-2 text-text-light/70 hover:text-red-600 dark:text-text-dark/70 dark:hover:text-red-400 transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
              <span className="material-icons-round text-xl">logout</span>
              <span className="text-sm font-semibold">تسجيل خروج</span>
            </button>

            <div className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
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
              <span className="material-icons-round text-xl">arrow_back</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex flex-col p-6 transition-all duration-300 mt-20">
        <div className="w-full max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="تأكيد تسجيل الخروج">
        <div className="flex flex-col gap-4">
          <p className="text-text-light dark:text-text-dark">
            هل أنت متأكد من رغبتك في تسجيل الخروج؟
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setIsLogoutModalOpen(false)}
              className="px-4 py-2 rounded-lg text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              إلغاء
            </button>
            <button
              onClick={handleConfirmLogout}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
              تسجيل خروج
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MainLayout;
