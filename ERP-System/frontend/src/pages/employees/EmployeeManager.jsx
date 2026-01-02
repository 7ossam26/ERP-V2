import React, { useState } from 'react';
import GenericPageManager from '../../components/shared/GenericPageManager';
import { employeeService } from '../../services/domainServices';

const EmployeeForm = ({ initialData, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        phone: initialData?.phone || '',
        nationalId: initialData?.nationalId || '',
        salary: initialData?.salary || '',
        branch: initialData?.branch || ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">الاسم بالكامل</label>
                <div className="relative">
                    <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow" 
                        name="name" value={formData.name} onChange={handleChange} placeholder="أدخل اسم الموظف" type="text" required />
                    <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">badge</span>
                </div>
            </div>
             <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">رقم الهاتف</label>
                <div className="relative">
                    <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-right" 
                        name="phone" value={formData.phone} onChange={handleChange} dir="ltr" placeholder="01xxxxxxxxx" type="tel" />
                    <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">call</span>
                </div>
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">الرقم القومي</label>
                <div className="relative">
                    <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow" 
                        name="nationalId" value={formData.nationalId} onChange={handleChange} placeholder="رقم البطاقة" type="text" />
                    <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">fingerprint</span>
                </div>
            </div>
             <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">الراتب</label>
                <div className="relative">
                    <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-right" 
                        name="salary" value={formData.salary} onChange={handleChange} dir="ltr" placeholder="0.00" type="number" step="0.01" />
                    <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">attach_money</span>
                </div>
            </div>
            
            <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
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

const EmployeeManager = () => {
    const columns = [
        { header: 'الموظف', accessor: 'name', render: (item) => (
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">{item.name?.charAt(0)}</div>
                <div className="font-bold text-gray-900 dark:text-white">{item.name}</div>
            </div>
        )},
        { header: 'رقم الهاتف', accessor: 'phone', render: (item) => <span dir="ltr" className="text-gray-600 dark:text-gray-300">{item.phone}</span> },
        { header: 'الراتب', accessor: 'salary', render: (item) => <span className="font-mono text-green-600">{item.salary} ج.م</span> },
    ];

    return (
        <GenericPageManager
            title="إدارة الموظفين"
            subtitle="قائمة بجميع الموظفين المسجلين في النظام"
            icon="badge"
            service={employeeService}
            columns={columns}
            FormComponent={EmployeeForm}
            emptyMessage="لا يوجد موظفين مسجلين."
        />
    );
};

export default EmployeeManager;
