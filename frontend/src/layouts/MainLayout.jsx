import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import Modal from "../components/ui/Modal";
import Footer from "../components/shared/Footer";
import BranchSwitcher from "../components/BranchSwitcher";
import NotificationBell from "../components/orders/NotificationBell";

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // Use state for user to trigger re-renders when profile refreshes
  const [user, setUser] = useState(AuthService.getCurrentUser());

  // Refresh user profile on navigation to ensure permissions are up to date
  // We use a ref to track the last refresh time to avoid excessive API calls
  const lastRefreshRef = React.useRef(0);

  useEffect(() => {
    const refreshUser = async () => {
      const now = Date.now();
      // Only refresh if more than 10 seconds have passed since last check
      // This prevents excessive calls when navigating quickly
      if (now - lastRefreshRef.current < 10000) {
        return;
      }

      lastRefreshRef.current = now;
      const updatedUser = await AuthService.refreshProfile();
      if (updatedUser) {
        setUser(updatedUser);
      }
    };
    refreshUser();
  }, [location.pathname]);

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    await AuthService.logout();
    setIsLogoutModalOpen(false);
    navigate("/");
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (isUserDropdownOpen && !event.target.closest(".user-dropdown")) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserDropdownOpen]);

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body transition-colors duration-300 min-h-screen flex flex-col relative overflow-hidden">
      {/* Navigation */}
      <nav className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark shadow-sm z-50 fixed top-0 w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20 items-center relative">
            <div className="flex items-center gap-2">
              {/* Back Button */}
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-text-light/70 hover:text-primary dark:text-text-dark/70 dark:hover:text-primary transition-colors duration-200 px-2 sm:px-4 py-2 rounded-lg hover:bg-primary/10 dark:hover:bg-primary/20 min-w-touch min-h-touch justify-center">
                <span className="material-icons-round text-xl">
                  arrow_forward
                </span>
                <span className="text-sm font-semibold hidden sm:inline">
                  رجوع
                </span>
              </button>

              {/* Home Page Button - Icon only on mobile */}
              <Link
                to="/dashboard"
                className="flex items-center gap-2 text-text-light/70 hover:text-primary dark:text-text-dark/70 dark:hover:text-primary transition-colors duration-200 px-2 sm:px-4 py-2 rounded-lg hover:bg-primary/10 dark:hover:bg-primary/20 min-w-touch min-h-touch justify-center">
                <span className="material-icons-round text-xl">home</span>
                <span className="text-sm font-semibold hidden sm:inline">
                  الصفحة الرئيسية
                </span>
              </Link>
            </div>

            <Link
              to="/dashboard"
              className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2 hover:opacity-80 transition-opacity">
              <img
                src="/assets/logo.png"
                alt="Elghonemy Logo"
                className="h-12 sm:h-16 w-auto object-contain"
              />
            </Link>

            <div className="flex items-center gap-3">
              {/* Branch Switcher */}
              <BranchSwitcher />

              {/* Realtime notifications bell */}
              <div className="text-text-light dark:text-text-dark">
                <NotificationBell />
              </div>

              {/* Help / User Manual Button */}
              <Link
                to="/manual"
                title="دليل المستخدم"
                className="flex items-center justify-center w-9 h-9 rounded-full text-text-light/60 hover:text-primary dark:text-text-dark/60 dark:hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors">
                <span className="material-icons-round text-xl">help_outline</span>
              </Link>

              {/* User Profile Dropdown */}
              <div className="relative user-dropdown">
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 rounded-lg hover:bg-accent/10 dark:hover:bg-accent/5 transition-colors min-w-touch min-h-touch">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-text-light dark:text-text-dark">
                      {user?.name || "المستخدم"}
                    </p>
                    <p className="text-xs text-text-light/60 dark:text-text-dark/60">
                      {user?.role || ""}
                    </p>
                  </div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="material-icons-round text-primary text-lg sm:text-xl">
                      person
                    </span>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isUserDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-44 sm:w-48 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg py-2 z-50">
                    {/* Swapped: Logout Button (was Home Page) */}
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        handleLogoutClick();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors min-h-touch">
                      <span className="material-icons-round text-lg">
                        logout
                      </span>
                      <span className="text-sm">تسجيل خروج</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex flex-col p-3 sm:p-6 transition-all duration-300 mt-16 sm:mt-20">
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

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default MainLayout;
