import React, { useState } from 'react';
import GenericPageManager from '../../components/shared/GenericPageManager';
import { itemService } from '../../services/domainServices';

const ItemForm = ({ initialData, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        code: initialData?.code || '',
        price: initialData?.price || '',
        unit: initialData?.unit || 'piece'
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
            <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">اسم الصنف</label>
                <div className="relative">
                    <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow" 
                        name="name" value={formData.name} onChange={handleChange} placeholder="أدخل اسم الصنف" type="text" required />
                    <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">category</span>
                </div>
            </div>
             <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">سعر البيع</label>
                <div className="relative">
                    <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-right" 
                        name="price" value={formData.price} onChange={handleChange} dir="ltr" placeholder="0.00" type="number" step="0.01" />
                    <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">attach_money</span>
                </div>
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">الوحدة</label>
                <div className="relative">
                    <select className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                        name="unit" value={formData.unit} onChange={handleChange}>
                        <option value="piece">قطعة</option>
                        <option value="kg">كيلو جرام</option>
                        <option value="box">علبة</option>
                    </select>
                    <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">scale</span>
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

const ItemManager = () => {
    const columns = [
        { header: 'الصنف', accessor: 'name', render: (item) => <div className="font-bold text-gray-900 dark:text-white">{item.name}</div> },
        { header: 'السعر', accessor: 'price', render: (item) => <span className="font-bold text-primary">{item.price} ج.م</span> },
        { header: 'الوحدة', accessor: 'unit', render: (item) => <span className="text-gray-500">{item.unit === 'piece' ? 'قطعة' : item.unit === 'kg' ? 'كجم' : 'علبة'}</span> },
    ];

    return (
        <GenericPageManager
            title="إدارة الأصناف"
            subtitle="المنتجات والأسعار والمخزون"
            icon="category"
            service={itemService}
            columns={columns}
            FormComponent={ItemForm}
            emptyMessage="لا توجد أصناف مسجلة."
        />
    );
};

export default ItemManager;
