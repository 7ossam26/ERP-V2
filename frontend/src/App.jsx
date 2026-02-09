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
import DepositPage from "./pages/deposits/DepositPage";
import CashTransferHistory from "./pages/reports/history/CashTransferHistory";
import CreationHistory from "./pages/reports/history/CreationHistory";
import DailyTransactions from "./pages/reports/history/DailyTransactions";
import DeductionHistory from "./pages/reports/history/DeductionHistory";
import PurchaseHistory from "./pages/reports/history/PurchaseHistory";
import StockTransferHistory from "./pages/reports/history/StockTransferHistory";
import SettingsPage from "./pages/settings/SettingsPage";
import TransferManagementPage from "./pages/treasuries/TransferManagementPage";
import ShiftManagementPage from "./pages/shifts/ShiftManagementPage";
import SupplierAccountsPage from "./pages/suppliers/SupplierAccountsPage";
import DeliveryMenPage from "./pages/delivery/DeliveryMenPage";
import DeliveryZonesPage from "./pages/delivery/DeliveryZonesPage";
import DeliverySettlementPage from "./pages/delivery-settlement/DeliverySettlementPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import NotFoundPage from "./pages/NotFoundPage";

// import { HRPage } from "./pages/ModulePlaceholders"; // Removed as implemented

import { seedData } from "./services/seedData";
import SessionTimeoutWarning from "./components/SessionTimeoutWarning";

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
      <div className="no-print">
        <Toaster position="top-center" reverseOrder={false} />
      </div>
      <SessionTimeoutWarning />
      <Routes>
        {/* Public Route: Login */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {/* Standalone Route: POS (No MainLayout) */}
        <Route
          path="/pos"
          element={
            <ProtectedRoute requiredPermission="POS">
              <POSPage />
            </ProtectedRoute>
          }
        />

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
          <Route
            path="/warehouses"
            element={
              <ProtectedRoute
                requiredPermission={["WAREHOUSES", "CREATES_WAREHOUSES"]}>
                <WarehouseManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute
                requiredPermission={["EMPLOYEES", "CREATES_EMPLOYEES"]}>
                <EmployeeManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute
                requiredPermission={["SUPPLIERS", "CREATES_SUPPLIERS"]}>
                <SupplierManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute
                requiredPermission={["CLIENTS", "CREATES_CLIENTS"]}>
                <ClientManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute
                requiredPermission={["CATEGORIES", "CREATES_CATEGORIES"]}>
                <CategoryManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items"
            element={
              <ProtectedRoute requiredPermission={["ITEMS", "CREATES_ITEMS"]}>
                <ItemManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/treasuries"
            element={
              <ProtectedRoute
                requiredPermission={["TREASURIES", "CREATES_TREASURIES"]}>
                <TreasuryManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/branches"
            element={
              <ProtectedRoute
                requiredPermission={["BRANCHES", "CREATES_BRANCHES"]}>
                <BranchManager />
              </ProtectedRoute>
            }
          />

          {/* Main Dashboard Modules */}
          <Route
            path="/purchases"
            element={
              <ProtectedRoute requiredPermission="PURCHASES">
                <PurchasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supplier-accounts"
            element={
              <ProtectedRoute requiredPermission="SUPPLIER_ACCOUNTS">
                <SupplierAccountsPage />
              </ProtectedRoute>
            }
          />
          {/* <Route path="/pos" element={<POSPage />} /> Moved to standalone */}
          <Route
            path="/stock-transfer"
            element={
              <ProtectedRoute requiredPermission="STOCK_TRANSFER">
                <StockTransferPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cashier-transfer"
            element={
              <ProtectedRoute requiredPermission="CASH_TRANSFER">
                <CashierTransferPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/branches-sales"
            element={
              <ProtectedRoute requiredPermission="BRANCHES">
                <BranchesSalesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute requiredPermission="INVENTORY_COUNT">
                <InventoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/general"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <GeneralReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/detailed"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <DetailedReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute requiredPermission="EXPENSES">
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deposits"
            element={
              <ProtectedRoute requiredPermission="DEPOSITS">
                <DepositPage />
              </ProtectedRoute>
            }
          />

          {/* Detailed History Reports - All require REPORTS permission */}
          <Route
            path="/reports/custom/advance-payments"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <AdvancePaymentsHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/custom/cash-transfers"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <CashTransferHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/custom/creations"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <CreationHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/custom/daily-transactions"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <DailyTransactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/custom/deductions"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <DeductionHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/custom/purchases"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <PurchaseHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/custom/stock-transfers"
            element={
              <ProtectedRoute requiredPermission="REPORTS">
                <StockTransferHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr"
            element={
              <ProtectedRoute requiredPermission="EMPLOYEES">
                <HRPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredPermission="SETTINGS">
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfer-management"
            element={
              <ProtectedRoute
                requiredPermission={["TREASURIES", "CASH_TRANSFER"]}>
                <TransferManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shifts"
            element={
              <ProtectedRoute requiredPermission="SHIFTS">
                <ShiftManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery-men"
            element={
              <ProtectedRoute requiredPermission="CREATES_DELIVERY_MEN">
                <DeliveryMenPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery-zones"
            element={
              <ProtectedRoute requiredPermission="CREATES_DELIVERY_ZONES">
                <DeliveryZonesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery-settlement"
            element={
              <ProtectedRoute
                requiredPermission="DELIVERY_SETTLEMENT">
                <DeliverySettlementPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 404 Catch-All Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
