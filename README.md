# ERP System V2 (نظام إدارة الموارد المؤسسية)

Modern, full-featured Enterprise Resource Planning (ERP) & Point of Sale (POS) solution built for business operations, retail, delivery, and call center management. Tailored for Arabic-speaking users with full RTL support, dark/light themes, custom thermal printing, and granular RBAC controls.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node->=%2020.0.0-green.svg)
![React](https://img.shields.io/badge/frontend-React%2019%20%7C%20Vite%20%7C%20Tailwind-orange.svg)
![Backend](https://img.shields.io/badge/backend-Express%20%7C%20Prisma%20%7C%20MySQL-purple.svg)

---

## 🚀 Key Modules & Features

### 🛒 Point of Sale (POS) & Shift Management
- **Fast POS Interface**: Item search, quick client add, custom discounts, and multi-unit support (kg/grams).
- **80mm Thermal Printing**: Automated thermal receipts for sales, refunds, shift reports, and stock transfers.
- **Shift Lifecycle**: Opening/closing shifts, cash drawer verification, shift approvals, and manager reopening logic.
- **Refund & Order History**: Comprehensive shift refund logs and customer receipts.

### 📞 Call Center & Delivery System
- **Call Center Module**: Multi-step order creation, branch assignment, customer phone lookup, cart drawer, and weight picker.
- **Delivery Management**: Delivery zones, delivery personnel tracking, pending delivery settlements, and printable settlement receipts.

### 📦 Inventory & Production (BOM)
- **Stock Control**: Warehouse management, stock transfers between branches with per-unit totals, initial inventory seeding, and stock write-offs.
- **Bill of Materials (BOM)**: Create BOM recipes, track production history, and enable automatic raw material consumption.

### 💼 Bulk Sales & Wholesale Module
- **Bulk Orders**: Dedicated workflow for bulk/wholesale clients, order management, customer statements, and bulk payment collection.

### 📥 Data Import & Audit Trail
- **Bulk Data Import**: Excel/CSV importer for Items, Clients, Suppliers, Employees, Warehouses, and Treasuries.
- **HMAC Audit Trail**: Immutable, tamper-evident audit logging for all critical system actions and security events.

### 💰 Finance, HR & Reporting
- **Treasury & Expenses**: Expense category management, cash withdrawals, treasury transfers, and branch balances.
- **HR & Payroll**: Track attendance, work hours, overtime, bonuses, and employee financial transactions.
- **Analytics & Reports**: Visual charts and detailed tabular reports for sales, expenses, call center statistics, and branch performance.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, React Router 7, Chart.js, Lucide / Material Icons |
| **Backend** | Node.js (Express v5), Prisma ORM, MySQL (mysql2), JSON Web Tokens (JWT), Helmet |
| **Testing** | Playwright (E2E testing), Custom API Integration Test Suite |
| **PDF & Print** | Custom PDFKit Worker, Embedded Arabic Web Fonts (Cairo), Web Thermal Printer |

---

## ⚙️ Getting Started

### Prerequisites
- **Node.js**: `v20.0.0` or higher
- **MySQL Database**: Running locally or on a remote server

### Quick Start (Full Stack)

1. **Install Dependencies**
   ```bash
   npm run postinstall
   ```

2. **Environment Configuration**
   - Create `.env` in `backend/`:
     ```env
     DATABASE_URL="mysql://root:password@localhost:3306/erp_v2"
     PORT=3001
     JWT_SECRET="your-secret-key"
     ```

3. **Database Migration**
   ```bash
   npm run migrate
   ```

4. **Run Development Mode (Concurrent Frontend & Backend)**
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3001/api`

---

## 📂 Repository Structure

```
ERP-V2/
├── backend/                # Express API server & Prisma ORM
│   ├── prisma/             # Schema & migrations
│   ├── src/                # Controllers, routes, services & middleware
│   └── start.js            # Entry script
├── frontend/               # React Vite SPA
│   ├── src/
│   │   ├── components/     # Thermal receipts, UI primitives, modals
│   │   ├── contexts/       # Auth, Branch, Realtime Notifications
│   │   ├── pages/          # POS, Call Center, HR, Inventory, Reports, Superadmin
│   │   ├── services/       # Frontend API client services
│   │   └── utils/          # Printing, money formatting, PDF worker
├── docs/                   # System design, test plan & documentation
└── plans/                  # Architecture & module design specs
```

---

## 🔒 Security & RBAC
- **Role-Based Access Control**: Admins, Area Managers, Branch Managers, Cashiers, Call Center Agents, and Superadmin roles.
- **HMAC Audit Log**: Tamper-proof logging for database mutations and security actions.

---

## 📄 License
Private & Proprietary Software. All rights reserved.
