import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import apiClient from "../services/apiClient";
import AuthService from "../services/authService";
import Footer from "../components/shared/Footer";
import { useSystemSettings } from "../contexts/SystemSettingsContext";

const FALLBACK_PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
};

const buildPolicyHints = (policy) => {
  const hints = [`${policy.minLength} أحرف على الأقل`];

  if (policy.requireUppercase) {
    hints.push("حرف إنجليزي كبير واحد على الأقل");
  }
  if (policy.requireLowercase) {
    hints.push("حرف إنجليزي صغير واحد على الأقل");
  }
  if (policy.requireNumber) {
    hints.push("رقم واحد على الأقل");
  }
  if (policy.requireSpecialChar) {
    hints.push("رمز خاص واحد على الأقل");
  }

  return hints;
};

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const passwordPolicy = useMemo(
    () => ({
      ...FALLBACK_PASSWORD_POLICY,
      ...(settings?.passwordPolicy || {}),
    }),
    [settings?.passwordPolicy],
  );
  const passwordHints = useMemo(
    () => buildPolicyHints(passwordPolicy),
    [passwordPolicy],
  );
  const companyLogo = settings?.logoUrl || "/assets/logo.png";
  const companyName = settings?.companyName || "رامكس ستور";
  const companyNameEnglish = settings?.companyNameEnglish || "Ramex Store";

  const validatePassword = (password) => {
    if (password.length < passwordPolicy.minLength) {
      return `كلمة المرور يجب أن تكون ${passwordPolicy.minLength} أحرف على الأقل`;
    }
    if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      return "كلمة المرور يجب أن تحتوي على حرف إنجليزي كبير واحد على الأقل";
    }
    if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      return "كلمة المرور يجب أن تحتوي على حرف إنجليزي صغير واحد على الأقل";
    }
    if (passwordPolicy.requireNumber && !/\d/.test(password)) {
      return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل";
    }
    if (passwordPolicy.requireSpecialChar && !/[^A-Za-z0-9]/.test(password)) {
      return "كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل";
    }

    return null;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      toast.error("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }

    const passwordError = validatePassword(form.newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post("/auth/change-password", form);
      toast.success("تم تغيير كلمة المرور بنجاح");

      const user = AuthService.getCurrentUser();
      if (user) {
        localStorage.setItem(
          "user",
          JSON.stringify({ ...user, mustChangePassword: false }),
        );
      }

      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "فشل تغيير كلمة المرور";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-background-light font-display text-text-light antialiased transition-colors duration-200"
      dir="rtl">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="mx-auto w-full max-w-xl overflow-hidden rounded-[28px] border border-border-light bg-surface-light shadow-xl">
          <div className="flex flex-col gap-8 p-8 sm:p-10">
            <header className="flex flex-col items-center gap-4 text-center">
              <img
                src={companyLogo}
                alt={companyName}
                className="h-16 w-auto max-w-[180px] object-contain"
              />
              <div>
                <h1 className="text-2xl font-extrabold text-text-light">
                  تغيير كلمة المرور
                </h1>
                <p className="mt-2 text-sm text-text-light/70">
                  يجب تحديث كلمة المرور قبل متابعة استخدام النظام.
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-light/45">
                  {companyNameEnglish}
                </p>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="oldPassword"
                  className="block text-sm font-medium text-text-light">
                  كلمة المرور الحالية
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                    <span className="material-icons-round text-xl text-text-light/45">
                      lock
                    </span>
                  </div>
                  <input
                    id="oldPassword"
                    name="oldPassword"
                    type={showOld ? "text" : "password"}
                    value={form.oldPassword}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    placeholder="أدخل كلمة المرور الحالية"
                    className="h-12 w-full rounded-2xl border border-border-light bg-background-light pl-12 pr-12 text-text-light placeholder:text-text-light/45 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld((current) => !current)}
                    className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-light/45 transition-colors hover:text-text-light"
                    aria-label={showOld ? "إخفاء كلمة المرور الحالية" : "إظهار كلمة المرور الحالية"}>
                    <span className="material-icons-round text-xl">
                      {showOld ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-text-light">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                    <span className="material-icons-round text-xl text-text-light/45">
                      lock_open
                    </span>
                  </div>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showNew ? "text" : "password"}
                    value={form.newPassword}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    placeholder={`أدخل كلمة مرور جديدة (${passwordPolicy.minLength}+ أحرف)`}
                    className="h-12 w-full rounded-2xl border border-border-light bg-background-light pl-12 pr-12 text-text-light placeholder:text-text-light/45 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((current) => !current)}
                    className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-light/45 transition-colors hover:text-text-light"
                    aria-label={showNew ? "إخفاء كلمة المرور الجديدة" : "إظهار كلمة المرور الجديدة"}>
                    <span className="material-icons-round text-xl">
                      {showNew ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                <div className="rounded-2xl border border-border-light bg-background-light px-4 py-3">
                  <p className="text-xs font-bold text-text-light/75">
                    متطلبات كلمة المرور
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-text-light/65">
                    {passwordHints.map((hint) => (
                      <li key={hint}>• {hint}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-text-light">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                    <span className="material-icons-round text-xl text-text-light/45">
                      task_alt
                    </span>
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    className="h-12 w-full rounded-2xl border border-border-light bg-background-light pl-4 pr-12 text-text-light placeholder:text-text-light/45 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70">
                {isLoading ? (
                  <span className="material-icons-round animate-spin">refresh</span>
                ) : (
                  <>
                    <span className="font-bold">تغيير كلمة المرور</span>
                    <span className="material-icons-round text-xl">
                      check_circle
                    </span>
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
