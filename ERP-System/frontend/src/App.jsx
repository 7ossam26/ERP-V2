import React, { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import SuperadminLayout from "./layouts/SuperadminLayout";
import UserManagement from "./pages/superadmin/UserManagement";
import RoleManagement from "./pages/superadmin/RoleManagement";
import PermissionConfig from "./pages/superadmin/PermissionConfig";
import AuditLogs from "./pages/superadmin/AuditLogs";
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


import { seedData } from "./services/seedData";

function App() {
  useEffect(() => {
    // Seeding Logic
    Object.keys(seedData).forEach((key) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(seedData[key]));
        console.log(`Seeded ${key}`);
      }
    });
  }, []);

  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        {/* Public Route: Login */}
        <Route path="/" element={<LoginPage />} />

        {/* Standalone Route: POS (No MainLayout) */}
        <Route path="/pos" element={
          <ProtectedRoute requiredPermission={{ module: "POS", action: "view" }}>
            <POSPage />
          </ProtectedRoute>
        } />

        {/* Superadmin Routes */}
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute requiredRole="superadmin">
              <SuperadminLayout />
            </ProtectedRoute>
          }>
          <Route path="users" element={<UserManagement />} />
          <Route path="roles" element={<RoleManagement />} />
          <Route path="roles/:id/permissions" element={<PermissionConfig />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>

        {/* Protected Routes: Wrapped in MainLayout */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout>
                <Outlet />
              </MainLayout>
            </ProtectedRoute>
          }>
          <Route path="/dashboard" element={<MainDashboard />} />
          <Route path="/creates" element={<CreatesDashboard />} />

          {/* Modules under Creates */}
          <Route path="/warehouses" element={
            <ProtectedRoute requiredPermission={{ module: "WAREHOUSES", action: "view" }}>
              <WarehouseManager />
            </ProtectedRoute>
          } />
          <Route path="/employees" element={
            <ProtectedRoute requiredPermission={{ module: "EMPLOYEES", action: "view" }}>
              <EmployeeManager />
            </ProtectedRoute>
          } />
          <Route path="/suppliers" element={
            <ProtectedRoute requiredPermission={{ module: "SUPPLIERS", action: "view" }}>
              <SupplierManager />
            </ProtectedRoute>
          } />
          <Route path="/clients" element={
            <ProtectedRoute requiredPermission={{ module: "CLIENTS", action: "view" }}>
              <ClientManager />
            </ProtectedRoute>
          } />
          <Route path="/categories" element={
            <ProtectedRoute requiredPermission={{ module: "CATEGORIES", action: "view" }}>
              <CategoryManager />
            </ProtectedRoute>
          } />
          <Route path="/items" element={
            <ProtectedRoute requiredPermission={{ module: "ITEMS", action: "view" }}>
              <ItemManager />
            </ProtectedRoute>
          } />
          <Route path="/treasuries" element={
            <ProtectedRoute requiredPermission={{ module: "TREASURIES", action: "view" }}>
              <TreasuryManager />
            </ProtectedRoute>
          } />
          <Route path="/branches" element={
            <ProtectedRoute requiredPermission={{ module: "BRANCHES", action: "view" }}>
              <BranchManager />
            </ProtectedRoute>
          } />

          {/* Main Dashboard Modules */}
          <Route path="/purchases" element={
            <ProtectedRoute requiredPermission={{ module: "PURCHASES", action: "view" }}>
              <PurchasesPage />
            </ProtectedRoute>
          } />
          {/* <Route path="/pos" element={<POSPage />} /> Moved to standalone */}
          <Route path="/stock-transfer" element={
            <ProtectedRoute requiredPermission={{ module: "INVENTORY", action: "view" }}>
              <StockTransferPage />
            </ProtectedRoute>
          } />
          <Route path="/cashier-transfer" element={
            <ProtectedRoute requiredPermission={{ module: "TREASURIES", action: "view" }}>
              <CashierTransferPage />
            </ProtectedRoute>
          } />
          <Route path="/branches-sales" element={
            <ProtectedRoute requiredPermission={{ module: "BRANCHES", action: "view" }}>
              <BranchesSalesPage />
            </ProtectedRoute>
          } />
          <Route path="/inventory" element={
            <ProtectedRoute requiredPermission={{ module: "INVENTORY", action: "view" }}>
              <InventoryPage />
            </ProtectedRoute>
          } />

          <Route path="/reports" element={
            <ProtectedRoute requiredPermission={{ module: "REPORTS", action: "view" }}>
              <ReportsPage />
            </ProtectedRoute>
          } />
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
          <Route path="/hr" element={
            <ProtectedRoute requiredPermission={{ module: "HR", action: "view" }}>
              <HRPage />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
