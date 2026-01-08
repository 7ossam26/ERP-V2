import React, { useState, useEffect } from "react";
import SuperadminService from "../../services/superadminService";

const AuditLogs = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h1>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <span className="material-icons-round text-4xl text-slate-300 mb-2">history</span>
                <p className="text-slate-500">Audit logging features will be implemented in the next update.</p>
                <p className="text-xs text-slate-400 mt-2">Logs are currently being recorded in the database.</p>
            </div>
        </div>
    );
};

export default AuditLogs;
