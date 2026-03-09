import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import GenericDataTable from "./GenericDataTable";
import Modal from "../ui/Modal";
import Toast, { useToast } from "../ui/Toast";
import { confirmAction } from "../../utils/toastUtils";

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
  customActions,
  FilterComponent,
  ...props
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { toast, showToast, hideToast } = useToast();

  const loadData = async (filters = {}) => {
    setLoading(true);
    try {
      const result = await service.getAll(filters);
      setData(result);
    } catch (error) {
      console.error("Failed to load data", error);
      showToast(error.message || "فشل في تحميل البيانات. يرجى المحاولة مرة أخرى.", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle ESC key to navigate back when no modal is open
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape" && !isModalOpen) {
        navigate(backPath);
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isModalOpen, navigate, backPath]);

  const handleSave = async (formData, shouldClose = true) => {
    setIsSaving(true);
    try {
      if (editingItem) {
        await service.update(editingItem.id, formData);
        showToast("تم التحديث بنجاح", "success");
      } else {
        await service.create(formData);
        showToast("تمت الإضافة بنجاح", "success");
      }

      if (shouldClose) {
        setIsModalOpen(false);
        setEditingItem(null);
      }

      await loadData();
    } catch (error) {
      console.error("Failed to save data", error);
      showToast(error.message || "فشل في حفظ البيانات. يرجى المحاولة مرة أخرى.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    confirmAction("هل أنت متأكد من الحذف؟", async () => {
      setDeletingId(id);
      try {
        await service.delete(id);
        showToast("تم الحذف بنجاح", "success");
        await loadData();
      } catch (error) {
        console.error("Failed to delete", error);
        showToast(error.message || "فشل في حذف العنصر. يرجى المحاولة مرة أخرى.", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const openNewModal = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-100px)] transition-colors duration-200 print:h-auto print:shadow-none print:rounded-none">
      {/* Header */}
      <div className="px-6 py-5 sm:px-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-surface-dark z-10 shrink-0 print:border-b-2 print:border-black print:py-3">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-white w-12 h-12 flex items-center justify-center rounded-xl shadow-lg print:hidden">
            <span className="material-icons-round text-2xl">{icon}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 print:text-xl print:text-black">
              {title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 print:text-xs print:text-gray-700">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex-1 flex justify-center print:hidden">
          {headerActions}
        </div>
        <button
          onClick={() => navigate(backPath)}
          className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 print:hidden">
          <span className="material-icons-round text-2xl">close</span>
        </button>
      </div>

      {/* Filters Section */}
      {FilterComponent && (
        <div className="px-6 py-4 sm:px-8 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-700 shrink-0 print:hidden">
          <FilterComponent onFilter={loadData} {...props} />
        </div>
      )}

      {/* Table */}
      <div className="p-0 overflow-y-auto custom-scrollbar flex-grow bg-white dark:bg-surface-dark print:overflow-visible print:p-4">
        <GenericDataTable
          columns={columns}
          data={data}
          onEdit={customActions ? null : handleEdit}
          onDelete={customActions ? null : handleDelete}
          customActions={customActions}
          loading={loading}
          emptyMessage={emptyMessage}
        />
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-5 sm:px-8 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark/50 flex flex-col sm:flex-row gap-3 shrink-0 print:hidden">
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
        {FormComponent && (
          <FormComponent
            initialData={editingItem}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSave}
            isSaving={isSaving}
            data={data}
            showToast={showToast}
          />
        )}
      </Modal>

      {/* Toast Notifications */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </div>
  );
};

export default GenericPageManager;
