import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../ui/Icon";
import AuthService from "../../services/authService";
import BranchSwitcher from "../BranchSwitcher";
import Modal from "../ui/Modal";

export default function TopBar({ onOpenCommandPalette, sidebarPinned }) {
  const navigate = useNavigate();
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const dropdownRef = useRef(null);

  // Refresh user profile periodically
  const lastRefreshRef = useRef(0);
  useEffect(() => {
    const refresh = async () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < 10000) return;
      lastRefreshRef.current = now;
      const updated = await AuthService.refreshProfile();
      if (updated) setUser(updated);
    };
    refresh();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (isUserOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsUserOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isUserOpen]);

  const handleLogout = async () => {
    await AuthService.logout();
    setIsLogoutModalOpen(false);
    navigate("/");
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 z-30 h-topbar bg-surface dark:bg-surface-dark border-b border-line dark:border-line-dark flex items-center px-4 transition-all duration-300 ${
          sidebarPinned ? "right-sidebar" : "right-sidebar-collapsed"
        }`}
        style={{ right: sidebarPinned ? "240px" : "64px" }}
      >
        {/* Left: command palette trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-line dark:border-line-dark text-muted dark:text-muted-dark hover:border-accent dark:hover:border-accent-dark hover:text-accent dark:hover:text-accent-dark transition-colors text-sm"
        >
          <Icon name="search" size={16} />
          <span className="hidden sm:inline">بحث...</span>
          <kbd className="hidden sm:inline text-[11px] border border-line dark:border-line-dark rounded px-1.5 py-0.5 font-mono text-muted">
            Ctrl+K
          </kbd>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: branch + user */}
        <div className="flex items-center gap-3">
          <BranchSwitcher />

          <Link
            to="/manual"
            title="دليل المستخدم"
            className="flex items-center justify-center w-9 h-9 rounded-md text-muted hover:text-accent dark:hover:text-accent-dark hover:bg-accent-light dark:hover:bg-accent-light-dark transition-colors"
          >
            <Icon name="help_outline" size={20} />
          </Link>

          {/* User dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setIsUserOpen(!isUserOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent-light dark:hover:bg-accent-light-dark transition-colors min-h-touch"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-ink dark:text-ink-dark leading-tight">
                  {user?.name || "المستخدم"}
                </p>
                <p className="text-[11px] text-muted dark:text-muted-dark">
                  {user?.role || ""}
                </p>
              </div>
              <div className="w-9 h-9 bg-accent-light dark:bg-accent-light-dark rounded-full flex items-center justify-center">
                <Icon name="person" size={18} className="text-accent dark:text-accent-dark" />
              </div>
            </button>

            {isUserOpen && (
              <div className="absolute left-0 mt-1 w-44 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-md shadow-soft py-1 z-50 animate-fade-in">
                <button
                  onClick={() => {
                    setIsUserOpen(false);
                    setIsLogoutModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-danger dark:text-danger-dark transition-colors text-sm"
                >
                  <Icon name="logout" size={18} />
                  <span>تسجيل خروج</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout modal */}
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="تأكيد تسجيل الخروج"
      >
        <div className="flex flex-col gap-4">
          <p className="text-ink dark:text-ink-dark">
            هل أنت متأكد من رغبتك في تسجيل الخروج؟
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setIsLogoutModalOpen(false)}
              className="px-4 py-2 rounded-md text-ink dark:text-ink-dark hover:bg-canvas dark:hover:bg-canvas-dark transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-md bg-danger text-white hover:bg-danger/90 transition-colors"
            >
              تسجيل خروج
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
