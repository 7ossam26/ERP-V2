import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import AuthService from "../services/authService";
import { toast } from "react-hot-toast";
import Footer from "../components/shared/Footer";

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("كلمة المرور الجديدة وتأكيدها غير متطابقتين");
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    setIsLoading(true);
    try {
      await apiClient.post("/auth/change-password", form);
      toast.success("تم تغيير كلمة المرور بنجاح");

      // Clear mustChangePassword flag from local storage user object
      const user = AuthService.getCurrentUser();
      if (user) {
        localStorage.setItem("user", JSON.stringify({ ...user, mustChangePassword: false }));
      }

      navigate("/dashboard", { replace: true });
    } catch (error) {
      const msg = error?.response?.data?.error || error?.message || "فشل تغيير كلمة المرور";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark font-display antialiased transition-colors duration-200 flex flex-col min-h-screen" dir="rtl">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-lg mx-auto bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg overflow-hidden">
          <div className="flex flex-col p-8 sm:p-10 gap-8">
            <header className="flex items-center justify-center">
              <img src="/assets/logo.png" alt="Ramex Store" className="h-16 w-auto object-contain" />
            </header>

            <div>
              <h1 className="text-gray-900 dark:text-gray-100 text-2xl font-bold mb-1">
                تغيير كلمة المرور
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                يجب تغيير كلمة المرور قبل متابعة استخدام النظام
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Old Password */}
              <div className="space-y-2">
                <label className="block text-gray-900 dark:text-gray-100 text-sm font-medium">
                  كلمة المرور الحالية
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="material-icons-round text-gray-400 text-xl">lock</span>
                  </div>
                  <input
                    name="oldPassword"
                    type={showOld ? "text" : "password"}
                    value={form.oldPassword}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    placeholder="كلمة المرور الحالية"
                    className="w-full pr-12 pl-12 h-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld((v) => !v)}
                    className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 hover:text-gray-600">
                    <span className="material-icons-round text-xl">{showOld ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <label className="block text-gray-900 dark:text-gray-100 text-sm font-medium">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="material-icons-round text-gray-400 text-xl">lock_open</span>
                  </div>
                  <input
                    name="newPassword"
                    type={showNew ? "text" : "password"}
                    value={form.newPassword}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    placeholder="8 أحرف على الأقل"
                    className="w-full pr-12 pl-12 h-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 hover:text-gray-600">
                    <span className="material-icons-round text-xl">{showNew ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="block text-gray-900 dark:text-gray-100 text-sm font-medium">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="material-icons-round text-gray-400 text-xl">lock_open</span>
                  </div>
                  <input
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    placeholder="أعد كتابة كلمة المرور الجديدة"
                    className="w-full pr-12 pl-4 h-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-base shadow-lg shadow-primary/25 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed">
                {isLoading ? (
                  <span className="material-icons-round animate-spin">refresh</span>
                ) : (
                  <>
                    <span>تغيير كلمة المرور</span>
                    <span className="material-icons-round text-xl">check_circle</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ChangePasswordPage;
