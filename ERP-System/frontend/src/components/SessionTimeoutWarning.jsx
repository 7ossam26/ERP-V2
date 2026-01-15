import React, { useState, useEffect } from "react";
import AuthService from "../services/authService";
import apiClient from "../services/apiClient";

const SessionTimeoutWarning = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes

  useEffect(() => {
    let warningTimer;
    let countdownInterval;

    const startTimers = () => {
      // Clear existings
      clearTimeout(warningTimer);
      clearInterval(countdownInterval);
      setShowWarning(false);
      setCountdown(300);

      // Show warning after 25 minutes (plus 5 seconds buffer to allow auto-refresh to finish first)
      // Access Token expires in 30m. Auto-refresh runs at 25m.
      // We set this to 25m + 5s.
      // If auto-refresh succeeds, it fires 'tokenRefreshed', which calls startTimers() again, preventing this.
      // If auto-refresh fails, this timer fires, showing the modal.
      warningTimer = setTimeout(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        setShowWarning(true);

        // Start countdown
        countdownInterval = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              AuthService.logout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, 25 * 60 * 1000 + 5000); // 25 minutes + 5 seconds
    };

    startTimers();

    const handleTokenRefresh = () => {
      startTimers();
    };

    window.addEventListener("tokenRefreshed", handleTokenRefresh);

    return () => {
      clearTimeout(warningTimer);
      clearInterval(countdownInterval);
      window.removeEventListener("tokenRefreshed", handleTokenRefresh);
    };
  }, []);

  const handleExtendSession = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        AuthService.logout();
        return;
      }
      const response = await apiClient.post("/auth/refresh", { refreshToken });
      localStorage.setItem("token", response.token);
      window.dispatchEvent(new Event("tokenRefreshed"));
      setShowWarning(false);
    } catch (error) {
      console.error("Failed to extend session:", error);
      AuthService.logout();
    }
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-6 max-w-md mx-4 shadow-2xl transform transition-all scale-100">
        <div className="flex items-center gap-3 mb-4 text-warning">
          <span className="material-icons-round text-3xl">warning</span>
          <h3 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
            جلسة العمل ستنتهي قريباً
          </h3>
        </div>

        <p className="mb-6 text-text-secondary-light dark:text-text-secondary-dark">
          للحفاظ على أمان حسابك، سيتم تسجيل خروجك تلقائياً خلال{" "}
          <span className="font-bold text-primary text-lg font-mono">
            {Math.floor(countdown / 60)}:
            {(countdown % 60).toString().padStart(2, "0")}
          </span>{" "}
          دقيقة بسبب عدم النشاط.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleExtendSession}
            className="flex-1 bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg font-bold transition-colors active:scale-95">
            تمديد الجلسة
          </button>
          <button
            onClick={() => AuthService.logout()}
            className="flex-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-main-light dark:text-text-main-dark hover:bg-gray-100 dark:hover:bg-gray-800 py-2.5 rounded-lg font-medium transition-colors active:scale-95">
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeoutWarning;
