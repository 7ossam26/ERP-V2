# System Requirements Specification (SRS)

**Project Name**: ERP System (Next-Gen)
**Version**: 1.0
**Date**: 2026-01-04

## 1. Introduction

This document outlines the functional and non-functional requirements for the ERP system. The system is designed to streamline day-to-day business operations for retail and service-oriented businesses.

## 2. Functional Requirements

### 2.1 Point of Sale (POS)

- **REQ-POS-01**: User shall be able to add items to a cart via click or search.
- **REQ-POS-02**: System must support client selection during checkout.
- **REQ-POS-03**: System must calculate totals, taxes, and discounts automatically.
- **REQ-POS-04**: User shall be able to view and print "End of Shift" reports (X-Report/Z-Report).
- **REQ-POS-05**: Support for "Hold" and "Retrieve" cart functionality (future scope) or History viewing.

### 2.2 Inventory Management (المخازن)

- **REQ-INV-01**: User shall be able to list all items with current stock levels.
- **REQ-INV-02**: System must allow filtering items by Category and Warehouse (Branch).
- **REQ-INV-03**: User shall be able to track "Purchase Price" vs "Sales Price".
- **REQ-INV-04**: Visual indicators for Low Stock alerts.

### 2.3 Human Resources (HR)

- **REQ-HR-01**: Management of employee profiles (Name, Title, ID, Contact).
- **REQ-HR-02**: Tracking of work stats (Days, Hours, Weekend settings).
- **REQ-HR-03**: Management of financial transactions per employee (Advances, Deductions).
- **REQ-HR-04**: Calculation of "Remaining Salary" based on base salary minus deductions/advances.
- **REQ-HR-05**: Branch-based filtering for employee lists.

### 2.4 Financial & Reports

- **REQ-RPT-01**: Dashboard for summary statistics (Total Sales, Expenses, Net Profit).
- **REQ-RPT-02**: Detailed tables for Daily Transactions, Sales Records, and Purchases.
- **REQ-RPT-03**: Graphic visualization (Bar/Line/Pie charts) for performance analysis.
- **REQ-RPT-04**: Export capabilities (Print/PDF) for critical reports.

### 2.5 Master Data Management

- **REQ-MDM-01**: Management of Product Categories.
- **REQ-MDM-02**: Management of Suppliers and Clients.
- **REQ-MDM-03**: Management of Branches/Warehouses and Treasuries.

## 3. Non-Functional Requirements

### 3.1 User Interface & Experience (UI/UX)

- **NFR-UI-01**: The system must support **Right-to-Left (RTL)** layout natively for Arabic users.
- **NFR-UI-02**: The interface should be responsive, adapting to tablets and desktop screens.
- **NFR-UI-03**: Support for high-contrast **Dark Mode** to reduce eye strain.

### 3.2 Performance

- **NFR-PERF-01**: Page loads should not exceed 2 seconds for main dashboards.
- **NFR-PERF-02**: Data filtering on tables should be near-instantaneous (< 200ms) for datasets under 1000 records.

### 3.3 Reliability & Availability

- **NFR-REL-01**: System should handle network interruptions gracefully (offline capability considerations for POS).
- **NFR-REL-02**: Data persistence (currently local/mock) should ensure session data isn't lost on refresh where applicable.

## 4. Technical Constraints

- **Frontend**: React ecosystem.
- **State Management**: React Hooks (useState, useEffect, Context).
- **Styling**: Utility-first CSS (Tailwind).
- **Browser Support**: Modern Evergreen Browsers (Chrome, Edge, Firefox, Safari).
