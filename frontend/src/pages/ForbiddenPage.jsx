import React from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/ui/Icon";

const ForbiddenPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark p-4">
            <div className="text-center max-w-md">
                <div className="mb-6 relative">
                    <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full"></div>
                    <Icon name="gpp_bad" className="text-9xl text-red-500 relative z-10" />
                </div>

                <h1 className="text-4xl font-bold text-text-light dark:text-text-dark mb-4">
                    403 Access Denied
                </h1>

                <p className="text-lg text-text-light/70 dark:text-text-dark/70 mb-8">
                    You do not have permission to access this page. Please contact your administrator if you believe this is a mistake.
                </p>

                <div className="flex gap-4 justify-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:bg-surface-light dark:hover:bg-slate-800 transition-colors font-semibold"
                    >
                        Go Back
                    </button>
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="px-6 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors font-semibold shadow-lg shadow-primary/25"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForbiddenPage;
