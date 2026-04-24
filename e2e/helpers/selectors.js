// Centralized UI selectors — no data-testid exists in the codebase
// All selectors use placeholders, text content, roles, and CSS

module.exports = {
  // Login page
  login: {
    username: 'input[placeholder="Enter your username"]',
    password: 'input[type="password"]',
    submit: 'button[type="submit"]',
  },

  // Generic table (GenericDataTable)
  table: {
    header: 'thead',
    headerRow: 'thead tr',
    body: 'tbody',
    rows: 'tbody tr',
    addButton: 'text=إضافة',
    editButton: 'text=edit',
    deleteButton: 'text=delete',
  },

  // Modal
  modal: {
    container: '[class*="fixed inset-0"]',
    closeButton: 'text=close',
    saveButton: 'text=حفظ',
    cancelButton: 'text=إلغاء',
  },

  // POS
  pos: {
    categoryTabs: '[class*="category"]',
    cart: '[class*="cart"]',
    totalAmount: '[class*="total"]',
    clearButton: 'text=إلغاء',
    holdButton: 'text=تعليق',
    payButton: 'text=دفع',
    customerSearch: 'input[placeholder*="عميل"]',
  },

  // Purchases
  purchases: {
    supplierSelect: 'select',
    itemSearch: 'input[placeholder="ابحث عن صنف..."]',
    addItemRow: 'text=إضافة صنف جديد',
    holdButton: 'text=تعليق',
    saveButton: 'text=حفظ وطباعة',
    historyButton: 'text=سجل المشتريات',
    returnButton: 'text=مرتجع',
  },

  // Navigation
  nav: {
    backButton: 'text=رجوع',
    dashboard: 'text=الرئيسية',
  },

  // Toast
  toast: {
    success: '.go3958317564', // react-hot-toast success class
    error: '.go3958317564',
  },

  // Material icons
  icon: (name) => `span.material-symbols-outlined:has-text("${name}")`,
};
