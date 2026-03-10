import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SuperadminService from "../../services/superadminService";
import { toast } from "react-hot-toast";
import { getManagementModules, getCreationModules } from "../../config/modules";

const PermissionConfig = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [role, setRole] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    const managementModules = getManagementModules();
    const creationModules = getCreationModules();

    // Helper to get all unique permission codes
    const getAllPermissionCodes = () => {
        const codes = new Set();
        [...managementModules, ...creationModules].forEach(m => codes.add(m.code));
        return Array.from(codes);
    };

    useEffect(() => {
        // Initialize default permissions for ALL unique codes
        const defaultPerms = {};
        getAllPermissionCodes().forEach(code => {
            defaultPerms[code] = { module: code, canAccess: false };
        });
        setPermissions(defaultPerms);

        const fetchData = async () => {
            try {
                const [roleRes, permRes] = await Promise.all([
                    SuperadminService.getRole(id),
                    SuperadminService.getPermissions(id)
                ]);

                setRole(roleRes.data || roleRes);

                // Overlay existing permissions
                const loadedPerms = { ...defaultPerms };
                const permissionsData = permRes.data || permRes;

                if (permissionsData && Array.isArray(permissionsData)) {
                    permissionsData.forEach(p => {
                        loadedPerms[p.module] = {
                            module: p.module,
                            canAccess: !!p.canAccess
                        };
                    });
                }
                setPermissions(loadedPerms);

            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error(error.message || "Error loading role data.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleToggle = (code) => {
        setPermissions(prev => ({
            ...prev,
            [code]: {
                ...prev[code],
                canAccess: !prev[code].canAccess
            }
        }));
    };

    const handleSave = async () => {
        try {
            const permissionArray = Object.values(permissions);
            await SuperadminService.updatePermissions(id, permissionArray);
            toast.success("Permissions saved successfully");
            navigate("/superadmin/roles");
        } catch (error) {
            console.error("Save error:", error);
            toast.error(error.message || "Failed to save permissions");
        }
    };

    const renderPermissionTable = (modules, title, icon) => (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm mb-8">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <span className="material-icons-round text-slate-500 dark:text-slate-400">{icon}</span>
                <h3 className="font-bold text-slate-700 dark:text-slate-200">{title}</h3>
            </div>
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 dark:bg-slate-700/20 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">
                    <tr>
                        <th className="p-4 w-3/4">Module Name</th>
                        <th className="p-4 text-center w-1/4">Access Granted</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {modules.map(module => {
                        // Check if this code is already handled by a previous row in THIS table to avoid duplicates in display?
                        // The user said "sync it by its name" and complained about duplicates.
                        // But if we iterate 'modules' (which comes from modules.js), we might have multiple items with same code.
                        // Example: Stock Transfer (INVENTORY) and Inventory (INVENTORY).
                        // If we render both, clicking one toggles 'INVENTORY'. Clicking other also toggles 'INVENTORY'.
                        // This seems to be what is requested: "loop on cards... and sync it by name".
                        // So we render ALL cards.

                        const isGranted = permissions[module.code]?.canAccess;

                        return (
                            <tr key={module.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition cursor-pointer" onClick={() => handleToggle(module.code)}>
                                <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                                    {module.label}
                                </td>
                                <td className="p-4 text-center">
                                    <div
                                        role="switch"
                                        aria-checked={!!isGranted}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 mx-auto ${isGranted ? "bg-green-500" : "bg-slate-200 dark:bg-slate-600"}`}
                                    >
                                        <span className={`pointer-events-none h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${isGranted ? "translate-x-5" : "translate-x-0"}`} />
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    if (isLoading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="space-y-6 pb-24 max-w-4xl mx-auto">
            {/* Page header — static, does not overlay content */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Permissions: <span className="text-primary">{role?.name}</span>
                </h1>
                <p className="text-slate-500 text-sm">Configure granular access control</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {renderPermissionTable(managementModules, "Management Modules", "apps")}
                {renderPermissionTable(creationModules, "Creation Permissions", "add_circle")}
            </div>

            {/* Sticky bottom action bar — sticks within the scrollable content area */}
            <div className="sticky bottom-0 z-20 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-6 py-4 flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    Role: <span className="font-semibold text-slate-700 dark:text-slate-200">{role?.name}</span>
                </span>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate("/superadmin/roles")}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:brightness-110 transition shadow-lg shadow-primary/20 font-bold"
                    >
                        <span className="material-icons-round">save</span>
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PermissionConfig;
