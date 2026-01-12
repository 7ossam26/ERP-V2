import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthService from "../services/authService";
import { toast } from "react-hot-toast";
import Footer from "../components/shared/Footer";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Get return URL if exists
  const from = location.state?.from?.pathname || "/dashboard";

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
      const message =
        error.response?.data?.error ||
        "Login failed. Please check your credentials.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark font-display antialiased transition-colors duration-200 flex flex-col min-h-screen">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-lg mx-auto bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg overflow-hidden flex flex-col">
          <div className="w-full flex flex-col p-8 sm:p-10">
            <header className="flex items-center justify-center w-full mb-8">
              <img
                src="/assets/logo.png"
                alt="Elghonemy Logo"
                className="h-20 w-auto object-contain"
              />
            </header>

            <main className="flex-1 flex flex-col justify-center">
              <div className="w-full">
                <div className="mb-8">
                  <h1 className="text-gray-900 dark:text-gray-100 tracking-tight text-3xl sm:text-4xl font-bold leading-tight mb-2">
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
                        <span className="material-icons-round text-gray-400 dark:text-gray-500">
                          person
                        </span>
                      </div>
                      <input
                        className="w-full pl-12 pr-4 h-14 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
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
                        <span className="material-icons-round text-gray-400 dark:text-gray-500">
                          lock
                        </span>
                      </div>
                      <input
                        className="w-full pl-12 pr-12 h-14 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
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
                    className="w-full h-14 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-8 disabled:opacity-70 disabled:cursor-not-allowed">
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
