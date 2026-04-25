import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import { toast } from "react-hot-toast";
import { showErrorToast } from "../utils/toastUtils";
import Footer from "../components/shared/Footer";
import Icon from "../components/ui/Icon";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Get return URL if exists
  const from = location.state?.from?.pathname || "/dashboard";

  // Redirect if already logged in
  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (user) {
      if (user.role === "Superadmin") {
        navigate("/superadmin/users", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    setIsLoading(true);

    try {
      const response = await AuthService.login(email, password);

      toast.success(`مرحباً، ${response.user.username}!`);

      // Force password change before anything else
      if (response.user.mustChangePassword) {
        navigate("/change-password", { replace: true });
        return;
      }

      // Redirect based on role
      if (response.user.role === "Superadmin") {
        navigate("/superadmin/users");
      } else {
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error("Login error:", error);
      showErrorToast(error, "فشل تسجيل الدخول. يرجى التحقق من البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-canvas dark:bg-canvas-dark font-display antialiased transition-colors duration-200 flex flex-col min-h-screen">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-lg mx-auto bg-surface dark:bg-surface-dark rounded-[10px] shadow-soft dark:shadow-soft-dark overflow-hidden flex flex-col border border-line dark:border-line-dark">
          <div className="w-full flex flex-col p-8 sm:p-10">
            <header className="flex items-center justify-center w-full mb-8">
              <img
                src="/assets/logo.png"
                alt="Ramex Store Logo"
                className="h-20 w-auto object-contain"
              />
            </header>

            <main className="flex-1 flex flex-col justify-center">
              <div className="w-full">
                <div className="mb-8">
                  <h1 className="text-ink dark:text-ink-dark tracking-tight text-3xl sm:text-4xl font-bold leading-tight mb-2">
                    تسجيل الدخول
                  </h1>
                  <p className="text-muted dark:text-muted-dark text-base font-normal">
                    أدخل بياناتك للوصول إلى النظام
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-ink dark:text-ink-dark text-sm font-semibold">
                      اسم المستخدم
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <Icon name="person" size={20} className="text-muted" />
                      </div>
                      <input
                        className="w-full pr-12 pl-4 h-14 bg-canvas dark:bg-canvas-dark border border-line dark:border-line-dark rounded-md text-ink dark:text-ink-dark placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-accent transition-all duration-200"
                        placeholder="أدخل اسم المستخدم"
                        required
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-ink dark:text-ink-dark text-sm font-semibold">
                      كلمة المرور
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <Icon name="lock" size={20} className="text-muted" />
                      </div>
                      <input
                        className="w-full pr-12 pl-4 h-14 bg-canvas dark:bg-canvas-dark border border-line dark:border-line-dark rounded-md text-ink dark:text-ink-dark placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-accent transition-all duration-200"
                        placeholder="•••••••••"
                        required
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-14 bg-accent hover:bg-accent-hover text-white rounded-md font-bold text-base shadow-soft hover:shadow-soft active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-8 disabled:opacity-70 disabled:cursor-not-allowed">
                    {isLoading ? (
                      <Icon name="refresh" size={20} className="animate-spin" />
                    ) : (
                      <>
                        <span>تسجيل الدخول</span>
                        <Icon name="login" size={20} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </main>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LoginPage;
