# Enterprise Resource Planning (ERP) System

A modern, comprehensive web-based layout for managing business operations including Point of Sale (POS), Inventory, HR, and Financial Reporting. Built with performance and user experience in mind, tailored for Arabic-speaking users with full RTL and Dark Mode support.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Private-red.svg)
![Tech](https://img.shields.io/badge/tech-React%20%7C%20Vite%20%7C%20Tailwind-green.svg)

## 🚀 Key Features

- **Point of Sale (POS)**: Fast and efficient interface for processing sales, managing carts, and handling shift reports.
- **Inventory Management**: Track stock levels, manage items & categories, and monitor warehouses (المخازن).
- **Human Resources (HR)**: Employee management including attendance, salaries, bonuses, and deductions.
- **Financial Reports**: Detailed analytics for sales, expenses, and treasury movements with visual charts.
- **Branch & Warehouse Management**: Multi-branch support with specific controls for filtering data.
- **Suppliers & Clients**: CRM-like features to manage relationships with business partners.
- **Localization**: Native Arabic (RTL) support.
- **Theming**: Beautiful tailored UI with uniform Dark/Light mode.

## 🛠️ Technology Stack

- **Frontend Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Routing**: [React Router 7](https://reactrouter.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/) & react-chartjs-2
- **Icons**: Material Symbols & Icons

## 📦 Installation

Prerequisites: Node.js (v18 or higher recommended).

1.  **Clone the repository** (if applicable) or navigate to the project folder:

    ```bash
    cd ERP-System/frontend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## 🏃‍♂️ Usage

1.  **Start the development server**:
    ```bash
    npm run dev
    ```
2.  Open your browser and navigate to the local URL (usually `http://localhost:5173`).

## 📂 Project Structure

```
src/
├── components/     # Reusable UI components (Modals, Tables, etc.)
├── pages/          # Main application pages (POS, HR, Inventory, etc.)
│   ├── categories/ # Category management
│   ├── employees/  # HR & Employee management
│   ├── inventory/  # Inventory & Stock control
│   ├── pos/        # Point of Sale interface
│   └── reports/    # Financial & Operational reports
├── services/       # Mock domain services (API abstraction)
└── App.jsx         # Main application entry & routing
```

## 🤝 Contributing

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request
