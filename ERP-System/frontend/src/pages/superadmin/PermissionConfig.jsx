import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SuperadminService from "../../services/superadminService";
import { toast } from "react-hot-toast";

const MODULES = [
    "HR", "INVENTORY", "POS", "PURCHASES", "SALES", "REPORTS",
    "TREASURIES", "BRANCHES", "EMPLOYEES", "CLIENTS", "SUPPLIERS",
    "CATEGORIES", "ITEMS", "WAREHOUSES", "SETTINGS"
];

const PermissionConfig = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [role, setRole] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initialize default permissions immediately
        const defaultPerms = {};
        MODULES.forEach(m => {
            defaultPerms[m] = { module: m, canView: false, canCreate: false, canEdit: false, canDelete: false };
        });
        setPermissions(defaultPerms);

        const fetchData = async () => {
            try {
                // If id is 1 (Superadmin), hardcode the role name if fetch fails? 
                // Better to just rely on the fixed backend.

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
                            canView: p.canView,
                            canCreate: p.canCreate,
                            canEdit: p.canEdit,
                            canDelete: p.canDelete
                        };
                    });
                }
                setPermissions(loadedPerms);

            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error("Error loading role data. Defaulting to empty permissions.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleToggle = (module, action) => {
        setPermissions(prev => ({
            ...prev,
            [module]: {
                ...prev[module],
                [action]: !prev[module][action]
            }
        }));
    };

    const handleSave = async () => {
        try {
            const permissionArray = Object.values(permissions);
            console.log("Saving permissions payload:", permissionArray);
            await SuperadminService.updatePermissions(id, permissionArray);
            toast.success("Permissions saved successfully");
            navigate("/superadmin/roles");
        } catch (error) {
            toast.error("Failed to save permissions");
        }
    };

    if (isLoading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Permissions: <span className="text-red-600">{role?.name}</span>
                    </h1>
                    <p className="text-slate-500">Configure access levels for this role</p>
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
                        className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-900/20 font-bold"
                    >
                        <span className="material-icons-round">save</span>
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-sm font-bold uppercase">
                        <tr>
                            <th className="p-4 w-1/3">Module</th>
                            <th className="p-4 text-center w-1/6">View</th>
                            <th className="p-4 text-center w-1/6">Create</th>
                            <th className="p-4 text-center w-1/6">Edit</th>
                            <th className="p-4 text-center w-1/6">Delete</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {MODULES.map(module => (
                            <tr key={module} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                                <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                                    {module}
                                </td>
                                {['canView', 'canCreate', 'canEdit', 'canDelete'].map(action => (
                                    <td key={action} className="p-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={permissions[module]?.[action] || false}
                                            onChange={() => handleToggle(module, action)}
                                            className="w-5 h-5 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PermissionConfig;
