import React, { useState } from "react";

const ReportFilterForm = ({ onFilter, type = "generic" }) => {
    const [filters, setFilters] = useState({
        startDate: "",
        endDate: "",
        searchTerm: "",
        status: "",
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onFilter(filters);
    };

    const handleReset = () => {
        const resetState = {
            startDate: "",
            endDate: "",
            searchTerm: "",
            status: "",
        };
        setFilters(resetState);
        onFilter(resetState);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm mb-6 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                {/* Search Input */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-light dark:text-text-dark">
                        بحث
                    </label>
                    <div className="relative">
                        <input
                            name="searchTerm"
                            value={filters.searchTerm}
                            onChange={handleChange}
                            placeholder="بحث في السجلات..."
                            className="w-full pl-4 pr-10 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        />
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50 pointer-events-none text-[20px]">
                            search
                        </span>
                    </div>
                </div>

                {/* Start Date */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-light dark:text-text-dark">
                        من تاريخ
                    </label>
                    <input
                        type="date"
                        name="startDate"
                        value={filters.startDate}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-numbers cursor-pointer"
                    />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-light dark:text-text-dark">
                        إلى تاريخ
                    </label>
                    <input
                        type="date"
                        name="endDate"
                        value={filters.endDate}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-numbers cursor-pointer"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        type="submit"
                        className="flex-1 bg-primary hover:bg-primary-hover text-white py-2.5 px-4 rounded-lg font-bold shadow-sm transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">
                            filter_list
                        </span>
                        تصفية
                    </button>
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-2.5 border border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:bg-background-light dark:hover:bg-background-dark rounded-lg font-bold transition-all text-sm">
                        إعادة تعيين
                    </button>
                </div>
            </div>
        </form>
    );
};

export default ReportFilterForm;
