import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import { toast } from "react-hot-toast";
import { showErrorToast } from "../utils/toastUtils";
import Footer from "../components/shared/Footer";
import BrandLogo from "../components/shared/BrandLogo";

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
      toast.error("Please enter both username and password");
      return;
    }

    setIsLoading(true);

    try {
      const response = await AuthService.login(email, password);

      toast.success(`Welcome back, ${response.user.username}!`);

      // Redirect based on role
      if (response.user.role === "Superadmin") {
        navigate("/superadmin/users");
      } else {
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error("Login error:", error);
      showErrorToast(error, "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-display antialiased transition-colors duration-200 flex flex-col min-h-screen relative isolate overflow-hidden">
      {/* Decorative brand glow */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-secondary/15 blur-3xl" />
      </div>
      <div className="flex-grow flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl mx-auto bg-surface-light dark:bg-surface-dark rounded-3xl shadow-card border border-border-light dark:border-border-dark overflow-hidden grid lg:grid-cols-2">
          {/* Brand panel */}
          <aside className="relative hidden lg:flex flex-col justify-between p-10 bm-gradient text-white overflow-hidden">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10" aria-hidden="true" />
            <div className="absolute bottom-10 -left-20 w-72 h-72 rounded-full bg-coral/30 blur-2xl" aria-hidden="true" />
            <div className="absolute bottom-24 left-12 w-20 h-20 rounded-3xl bg-citrus/40 rotate-12" aria-hidden="true" />
            <BrandLogo size="md" inverted className="relative" />
            <div className="relative" dir="rtl">
              <h2 className="text-4xl font-extrabold leading-tight mb-4">
                أناقتك تبدأ من هنا
              </h2>
              <p className="text-white/80 text-base leading-relaxed max-w-sm">
                نظام BerryModa لإدارة المبيعات والمخزون والفروع — كل ما يحتاجه متجرك في مكان واحد.
              </p>
            </div>
            <div className="relative flex gap-3" aria-hidden="true">
              {["checkroom", "shopping_bag", "diamond", "loyalty"].map((icon) => (
                <span
                  key={icon}
                  className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                  <span className="material-icons-round">{icon}</span>
                </span>
              ))}
            </div>
          </aside>

          <div className="w-full flex flex-col p-8 sm:p-12">
            <header className="flex items-center justify-center w-full mb-10 lg:hidden">
              <BrandLogo size="lg" />
            </header>

            <main className="flex-1 flex flex-col justify-center">
              <div className="w-full">
                <div className="mb-8">
                  <h1 className="bm-gradient-text tracking-tight text-3xl sm:text-4xl font-extrabold leading-tight mb-2">
                    Welcome Back
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 text-base font-normal">
                    Please sign in to access the system
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-gray-900 dark:text-gray-100 text-base font-medium">
                      Username
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-icons-round text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors">
                          person
                        </span>
                      </div>
                      <input
                        className="w-full pl-12 pr-4 h-14 bg-surface-raised dark:bg-gray-800 border border-border-light dark:border-gray-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary focus:bg-white transition-all duration-200"
                        placeholder="Enter your username"
                        required
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-gray-900 dark:text-gray-100 text-base font-medium">
                        Password
                      </label>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-icons-round text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors">
                          lock
                        </span>
                      </div>
                      <input
                        className="w-full pl-12 pr-12 h-14 bg-surface-raised dark:bg-gray-800 border border-border-light dark:border-gray-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary focus:bg-white transition-all duration-200"
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
                    className="w-full h-14 bm-gradient hover:brightness-110 text-white rounded-2xl font-bold text-base shadow-glow active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-8 disabled:opacity-70 disabled:cursor-not-allowed">
                    {isLoading ? (
                      <span className="material-icons-round animate-spin">
                        refresh
                      </span>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <span className="material-icons-round text-xl">
                          login
                        </span>
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
