import React, { useState } from 'react';
import GenericPageManager from '../../components/shared/GenericPageManager';
import { treasuryService } from '../../services/domainServices';

const TreasuryForm = ({ initialData, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">اسم الخزينة</label>
                <div className="relative">
                    <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow" 
                        name="name" value={formData.name} onChange={handleChange} placeholder="أدخل اسم الخزينة" type="text" required />
                    <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">savings</span>
                </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all">
                    إلغاء
                </button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                    <span className="material-icons-round text-lg">save</span>
                    <span>حفظ التغييرات</span>
                </button>
            </div>
        </form>
    );
};

const TreasuryManager = () => {
    const columns = [
        { header: 'الخزينة', accessor: 'name', render: (item) => <div className="font-bold text-gray-900 dark:text-white">{item.name}</div> },
    ];

    return (
        <GenericPageManager
            title="إدارة الخزائن"
            subtitle="الخزائن والمالية"
            icon="savings"
            service={treasuryService}
            columns={columns}
            FormComponent={TreasuryForm}
            emptyMessage="لا توجد خزائن مسجلة."
        />
    );
};

export default TreasuryManager;
