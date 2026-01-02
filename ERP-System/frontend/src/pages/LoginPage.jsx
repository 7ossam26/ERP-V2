import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    // Mock login logic
    if (email && password) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark font-display antialiased transition-colors duration-200 flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-lg mx-auto bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg overflow-hidden flex flex-col">
        <div className="w-full flex flex-col p-8 sm:p-10">
          <header className="flex items-center justify-between w-full mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <span className="material-icons-round text-2xl">coffee</span>
              </div>
              <div>
                <h2 className="text-gray-900 dark:text-gray-100 text-lg font-bold leading-none tracking-tight">
                  elghonemy
                </h2>
                <h2 className="text-gray-500 dark:text-gray-400 text-sm font-bold leading-none mt-1">
                  بن الغنيمي
                </h2>
              </div>
            </div>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary transition-colors cursor-pointer group">
              <span className="material-icons-round text-gray-500 dark:text-gray-400 group-hover:text-primary text-xl">
                language
              </span>
              <span className="text-gray-900 dark:text-gray-100 text-sm font-bold">
                EN | AR
              </span>
            </button>
          </header>

          <main className="flex-1 flex flex-col justify-center">
            <div className="w-full">
              <div className="mb-8">
                <h1 className="text-gray-900 dark:text-gray-100 tracking-tight text-3xl sm:text-4xl font-bold leading-tight mb-2">
                  Welcome Back
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-base font-normal">
                  Please sign in to your POS terminal
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-gray-900 dark:text-gray-100 text-base font-medium">
                    Employee ID / Email
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="material-icons-round text-gray-400 dark:text-gray-500">
                        badge
                      </span>
                    </div>
                    <input
                      className="w-full pl-12 pr-4 h-14 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                      placeholder="Enter your ID or Email"
                      required
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-gray-900 dark:text-gray-100 text-base font-medium">
                      Password
                    </label>
                    <a
                      className="text-sm font-bold text-primary hover:text-primary-hover transition-colors"
                      href="#">
                      Forgot Password?
                    </a>
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
                    />
                    <button
                      className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 dark:text-gray-500 hover:text-primary transition-colors"
                      type="button">
                      <span className="material-icons-round">visibility</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-14 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-8">
                  <span>Sign In</span>
                  <span className="material-icons-round text-xl">login</span>
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Having trouble?
                  <a
                    className="text-primary hover:text-primary-hover font-bold ml-1 transition-colors"
                    href="#">
                    Contact Support
                  </a>
                </p>
              </div>
            </div>
          </main>

          <footer className="mt-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              POS System v2.4.0 © 2024 elghonemy Coffee.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
