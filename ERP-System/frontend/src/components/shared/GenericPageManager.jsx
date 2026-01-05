import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import GenericDataTable from "./GenericDataTable";
import Modal from "../ui/Modal";

const GenericPageManager = ({
  title,
  subtitle,
  icon,
  service,
  columns,
  FormComponent,
  emptyMessage,
  backPath = "/creates",
  hideAddButton = false,
  headerActions,
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await service.getAll();
      setData(result);
    } catch (error) {
      console.error("Failed to load data", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (formData) => {
    try {
      if (editingItem) {
        await service.update(editingItem.id, formData);
      } else {
        await service.create(formData);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      loadData();
    } catch (error) {
      console.error("Failed to save data", error);
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("هل أنت متأكد من الحذف؟")) {
      try {
        await service.delete(id);
        loadData();
      } catch (error) {
        console.error("Failed to delete", error);
      }
    }
  };

  const openNewModal = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-140px)] transition-colors duration-200">
      {/* Header */}
      <div className="px-6 py-5 sm:px-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-surface-dark z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-white w-12 h-12 flex items-center justify-center rounded-xl shadow-lg">
            <span className="material-icons-round text-2xl">{icon}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex-1 flex justify-center">{headerActions}</div>
        <button
          onClick={() => navigate(backPath)}
          className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <span className="material-icons-round text-2xl">close</span>
        </button>
      </div>

      {/* Table */}
      <div className="p-0 overflow-y-auto custom-scrollbar flex-grow bg-white dark:bg-surface-dark">
        <GenericDataTable
          columns={columns}
          data={data}
          onEdit={handleEdit}
          onDelete={handleDelete}
          loading={loading}
          emptyMessage={emptyMessage}
        />
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-5 sm:px-8 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark/50 flex flex-col sm:flex-row gap-3 shrink-0">
        {!hideAddButton && (
          <button
            onClick={openNewModal}
            className="flex-1 sm:flex-none bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
            <span className="material-icons-round text-lg">add</span>
            إضافة جديد
          </button>
        )}
        <div className="flex-grow"></div>
        <button
          onClick={() => navigate(backPath)}
          className="flex-1 sm:flex-none bg-white dark:bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold py-3 px-8 rounded-xl transition-all">
          إغلاق
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `تعديل ${title}` : `إضافة ${title}`}>
        <FormComponent
          initialData={editingItem}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      </Modal>
    </div>
  );
};

export default GenericPageManager;
