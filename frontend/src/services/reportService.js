const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.error || "فشل تحميل البيانات");
    error.status = res.status;
    error.details = data.details;
    throw error;
  }
  return res.json();
}

async function downloadXlsx(path, filename) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("فشل تصدير الملف");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export const reportService = {
  // Track 1 - Owner Dashboard
  getOwnerDashboard: () => get("/reports/dashboard/owner"),

  // Track 2 - Reports
  getGeneralReport: (params) => get(`/reports/general?${new URLSearchParams(params)}`),

  getDailySales: (params) => get(`/reports/sales/daily?${new URLSearchParams(params)}`),
  exportDailySales: (params) => downloadXlsx(`/reports/sales/daily/export.xlsx?${new URLSearchParams(params)}`, "تقرير-المبيعات-اليومية"),

  getSalesByDimension: (params) => get(`/reports/sales/by-dimension?${new URLSearchParams(params)}`),
  exportSalesByDimension: (params) => downloadXlsx(`/reports/sales/by-dimension/export.xlsx?${new URLSearchParams(params)}`, "مبيعات-حسب-المحور"),

  getMarginBySKU: (params) => get(`/reports/margin-by-sku?${new URLSearchParams(params)}`),
  exportMarginBySKU: (params) => downloadXlsx(`/reports/margin-by-sku/export.xlsx?${new URLSearchParams(params)}`, "هامش-الربح-بالصنف"),

  getTopMovers: (params) => get(`/reports/top-movers?${new URLSearchParams(params)}`),
  exportTopMovers: (params) => downloadXlsx(`/reports/top-movers/export.xlsx?${new URLSearchParams(params)}`, "الأكثر-مبيعاً"),

  getDeadStock: (params) => get(`/reports/dead-stock?${new URLSearchParams(params)}`),
  exportDeadStock: (params) => downloadXlsx(`/reports/dead-stock/export.xlsx?${new URLSearchParams(params)}`, "المخزون-الراكد"),

  getFabricRemainingMeters: (params) => get(`/reports/fabric/remaining-meters?${new URLSearchParams(params)}`),
  exportFabricRemainingMeters: (params) => downloadXlsx(`/reports/fabric/remaining-meters/export.xlsx?${new URLSearchParams(params)}`, "متبقي-الأقمشة"),

  getFabricRollsByAge: (params) => get(`/reports/fabric/rolls-by-age?${new URLSearchParams(params)}`),
  exportFabricRollsByAge: (params) => downloadXlsx(`/reports/fabric/rolls-by-age/export.xlsx?${new URLSearchParams(params)}`, "لفات-الأقمشة-حسب-العمر"),

  getShiftReconciliation: (params) => get(`/reports/shift-reconciliation?${new URLSearchParams(params)}`),
  exportShiftReconciliation: (params) => downloadXlsx(`/reports/shift-reconciliation/export.xlsx?${new URLSearchParams(params)}`, "تسوية-الورديات"),

  getBranches: () => get("/branches"),
};
