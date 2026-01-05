import React from "react";
import { Toaster } from "react-hot-toast";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import LoginPage from "./pages/LoginPage";
import MainDashboard from "./pages/MainDashboard";
import CreatesDashboard from "./pages/CreatesDashboard";
import WarehouseManager from "./pages/warehouses/WarehouseManager";
import EmployeeManager from "./pages/employees/EmployeeManager";
import SupplierManager from "./pages/suppliers/SupplierManager";
import ClientManager from "./pages/clients/ClientManager";
import CategoryManager from "./pages/categories/CategoryManager";
import ItemManager from "./pages/items/ItemManager";
import TreasuryManager from "./pages/treasuries/TreasuryManager";
import BranchManager from "./pages/branches/BranchManager";
import PurchasesPage from "./pages/purchases/PurchasesPage";
import POSPage from "./pages/pos/POSPage";
import StockTransferPage from "./pages/stock/StockTransferPage";
import CashierTransferPage from "./pages/treasuries/CashierTransferPage";
import BranchesSalesPage from "./pages/sales/BranchesSalesPage";
import InventoryPage from "./pages/inventory/InventoryPage";
import ReportsPage from "./pages/reports/ReportsPage";
import HRPage from "./pages/hr/HRPage";
import DetailedReportsPage from "./pages/reports/DetailedReportsPage";
import GeneralReportPage from "./pages/reports/GeneralReportPage"; // Import General Report
import AdvancePaymentsHistory from "./pages/reports/history/AdvancePaymentsHistory";
import ExpensesPage from "./pages/expenses/ExpensesPage";
import CashTransferHistory from "./pages/reports/history/CashTransferHistory";
import CreationHistory from "./pages/reports/history/CreationHistory";
import DailyTransactions from "./pages/reports/history/DailyTransactions";
import DeductionHistory from "./pages/reports/history/DeductionHistory";
import PurchaseHistory from "./pages/reports/history/PurchaseHistory";
import StockTransferHistory from "./pages/reports/history/StockTransferHistory";
// import { HRPage } from "./pages/ModulePlaceholders"; // Removed as implemented

function App() {
  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        {/* Public Route: Login */}
        <Route path="/" element={<LoginPage />} />

        {/* Standalone Route: POS (No MainLayout) */}
        <Route path="/pos" element={<POSPage />} />

        {/* Protected Routes: Wrapped in MainLayout */}
        <Route
          element={
            <MainLayout>
              <Outlet />
            </MainLayout>
          }>
          <Route path="/dashboard" element={<MainDashboard />} />
          <Route path="/creates" element={<CreatesDashboard />} />

          {/* Modules under Creates */}
          <Route path="/warehouses" element={<WarehouseManager />} />
          <Route path="/employees" element={<EmployeeManager />} />
          <Route path="/suppliers" element={<SupplierManager />} />
          <Route path="/clients" element={<ClientManager />} />
          <Route path="/categories" element={<CategoryManager />} />
          <Route path="/items" element={<ItemManager />} />
          <Route path="/treasuries" element={<TreasuryManager />} />
          <Route path="/branches" element={<BranchManager />} />

          {/* Main Dashboard Modules */}
          <Route path="/purchases" element={<PurchasesPage />} />
          {/* <Route path="/pos" element={<POSPage />} /> Moved to standalone */}
          <Route path="/stock-transfer" element={<StockTransferPage />} />
          <Route path="/cashier-transfer" element={<CashierTransferPage />} />
          <Route path="/branches-sales" element={<BranchesSalesPage />} />
          <Route path="/inventory" element={<InventoryPage />} />

          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/general" element={<GeneralReportPage />} />
          <Route path="/reports/detailed" element={<DetailedReportsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />

          {/* Detailed History Reports */}
          <Route
            path="/reports/custom/advance-payments"
            element={<AdvancePaymentsHistory />}
          />
          <Route
            path="/reports/custom/cash-transfers"
            element={<CashTransferHistory />}
          />
          <Route
            path="/reports/custom/creations"
            element={<CreationHistory />}
          />
          <Route
            path="/reports/custom/daily-transactions"
            element={<DailyTransactions />}
          />
          <Route
            path="/reports/custom/deductions"
            element={<DeductionHistory />}
          />
          <Route
            path="/reports/custom/purchases"
            element={<PurchaseHistory />}
          />
          <Route
            path="/reports/custom/stock-transfers"
            element={<StockTransferHistory />}
          />
          <Route path="/hr" element={<HRPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
