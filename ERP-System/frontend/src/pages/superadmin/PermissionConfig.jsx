import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SuperadminService from "../../services/superadminService";
import { toast } from "react-hot-toast";

const MANAGEMENT_MODULES = [
    "HR", "INVENTORY", "POS", "PURCHASES", "SALES", "REPORTS",
    "TREASURIES", "BRANCHES", "EMPLOYEES", "CLIENTS", "SUPPLIERS",
    "CATEGORIES", "ITEMS", "WAREHOUSES", "SETTINGS", "EXPENSES"
];

const CREATION_MODULES = [
    "CREATES_WAREHOUSES", "CREATES_EMPLOYEES", "CREATES_SUPPLIERS",
    "CREATES_CLIENTS", "CREATES_CATEGORIES", "CREATES_ITEMS",
    "CREATES_TREASURIES", "CREATES_BRANCHES"
];

const PermissionConfig = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [role, setRole] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initialize default permissions for ALL modules
        const defaultPerms = {};
        [...MANAGEMENT_MODULES, ...CREATION_MODULES].forEach(m => {
            defaultPerms[m] = { module: m, canAccess: false };
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
                        // Backend might return old fields, but we only care about canAccess
                        // If migrating from old data, they might not have canAccess set yet? 
                        // The database migration added default false. 
                        // If we want to be safe, we could check old fields, but let's assume cleaner start or manual update.
                        loadedPerms[p.module] = {
                            module: p.module,
                            canAccess: !!p.canAccess
                        };
                    });
                }
                setPermissions(loadedPerms);

            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error("Error loading role data.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleToggle = (module) => {
        setPermissions(prev => ({
            ...prev,
            [module]: {
                ...prev[module],
                canAccess: !prev[module].canAccess
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
            toast.error("Failed to save permissions");
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
                    {modules.map(module => (
                        <tr key={module} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition cursor-pointer" onClick={() => handleToggle(module)}>
                            <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                                {module.replace("CREATES_", "Create ")}
                            </td>
                            <td className="p-4 text-center">
                                <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 mx-auto ${permissions[module]?.canAccess ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-600'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${permissions[module]?.canAccess ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    if (isLoading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="space-y-6 pb-20 max-w-4xl mx-auto">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm sticky top-24 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Permissions: <span className="text-primary">{role?.name}</span>
                    </h1>
                    <p className="text-slate-500 text-sm">Configure granular access control</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate("/superadmin/roles")}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
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

            <div className="grid grid-cols-1 gap-6">
                {renderPermissionTable(MANAGEMENT_MODULES, "Management Modules", "apps")}
                {renderPermissionTable(CREATION_MODULES, "Creation Permissions", "add_circle")}
            </div>
        </div>
    );
};

export default PermissionConfig;
