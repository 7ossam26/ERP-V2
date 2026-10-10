import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import Modal from "../components/ui/Modal";
import Footer from "../components/shared/Footer";
import BranchSwitcher from "../components/BranchSwitcher";
import BrandLogo from "../components/shared/BrandLogo";

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

  const userInitial = (user?.name || user?.username || "?").trim().charAt(0);

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body transition-colors duration-300 min-h-screen flex flex-col relative isolate overflow-hidden">
      {/* Decorative brand glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden no-print" aria-hidden="true">
        <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-[26rem] h-[26rem] rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-[22rem] h-[22rem] rounded-full bg-coral/10 blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="bg-surface-light/85 dark:bg-surface-dark/85 backdrop-blur-md border-b border-border-light dark:border-border-dark shadow-sm z-50 fixed top-0 w-full">
        <div className="h-1 w-full bm-gradient" />
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between h-16 sm:h-[4.5rem] items-center relative">
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Back Button */}
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-text-light/70 hover:text-primary dark:text-text-dark/70 dark:hover:text-primary transition-colors duration-200 px-2 sm:px-3 py-2 rounded-full hover:bg-primary/10 dark:hover:bg-primary/20 min-w-touch min-h-touch justify-center">
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
                className={`flex items-center gap-2 transition-colors duration-200 px-2 sm:px-3 py-2 rounded-full min-w-touch min-h-touch justify-center ${
                  location.pathname === "/dashboard"
                    ? "bg-primary/10 text-primary dark:bg-primary/20"
                    : "text-text-light/70 hover:text-primary dark:text-text-dark/70 dark:hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20"
                }`}>
                <span className="material-icons-round text-xl">home</span>
                <span className="text-sm font-semibold hidden sm:inline">
                  الصفحة الرئيسية
                </span>
              </Link>
            </div>

            <Link
              to="/dashboard"
              aria-label="BerryModa"
              className="flex items-center absolute left-1/2 transform -translate-x-1/2 hover:opacity-90 transition-opacity">
              <span className="hidden md:inline-flex">
                <BrandLogo size="md" />
              </span>
              <img
                src="/assets/berrymoda-mark.svg"
                alt="BerryModa"
                className="h-10 w-10 md:hidden"
              />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Branch Switcher */}
              <BranchSwitcher />

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
                  className={`flex items-center gap-2 sm:gap-3 ps-1 pe-1 sm:pe-3 py-1 rounded-full border transition-colors min-w-touch min-h-touch ${
                    isUserDropdownOpen
                      ? "border-primary/30 bg-primary/5"
                      : "border-transparent hover:border-border-light dark:hover:border-border-dark hover:bg-accent/20 dark:hover:bg-accent/5"
                  }`}>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bm-gradient rounded-full flex items-center justify-center text-white font-bold shadow-glow">
                    {userInitial}
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-text-light dark:text-text-dark leading-tight">
                      {user?.name || "المستخدم"}
                    </p>
                    <p className="text-xs text-secondary/80 dark:text-text-dark/60 font-semibold">
                      {user?.role || ""}
                    </p>
                  </div>
                  <span className="material-icons-round text-base text-text-light/40 dark:text-text-dark/40 hidden sm:inline">
                    expand_more
                  </span>
                </button>

                {/* Dropdown Menu */}
                {isUserDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-56 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-card overflow-hidden z-50 animate-fade-in-up">
                    <div className="px-4 py-3 bg-surface-raised dark:bg-card-dark border-b border-border-light dark:border-border-dark">
                      <p className="text-sm font-bold text-text-light dark:text-text-dark truncate">
                        {user?.name || "المستخدم"}
                      </p>
                      {user?.role && (
                        <p className="text-xs text-text-light/60 dark:text-text-dark/60 truncate">
                          {user.role}
                        </p>
                      )}
                    </div>
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
                      <span className="text-sm font-semibold">تسجيل خروج</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow flex flex-col p-3 sm:p-6 transition-all duration-300 mt-[4.25rem] sm:mt-[4.75rem]">
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
              className="px-5 py-2.5 rounded-xl font-semibold text-text-light dark:text-text-dark border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              إلغاء
            </button>
            <button
              onClick={handleConfirmLogout}
              className="px-5 py-2.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm transition-colors">
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
