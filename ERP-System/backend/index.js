const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

console.log("Attempting to start server...");

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "ERP Backend Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Import routes
const authRouter = require("./routes/auth");
const employeesRouter = require("./routes/employees");
// ... other imports

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/superadmin", require("./routes/superadmin"));
app.use("/api/employees", employeesRouter);
const warehousesRouter = require("./routes/warehouses");
const treasuriesRouter = require("./routes/treasuries");
const branchesRouter = require("./routes/branches");
const clientsRouter = require("./routes/clients");
const suppliersRouter = require("./routes/suppliers");
const categoriesRouter = require("./routes/categories");
const itemsRouter = require("./routes/items");
const purchasesRouter = require("./routes/purchases");
const salesRouter = require("./routes/sales");
const settingsRouter = require("./routes/settings");

// Database connection
const prisma = require("./config/database");

// API Routes
app.use("/api/employees", employeesRouter);
app.use("/api/warehouses", warehousesRouter);
app.use("/api/treasuries", treasuriesRouter);
app.use("/api/branches", branchesRouter);
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/clients", clientsRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/items", itemsRouter);
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/purchases", purchasesRouter);
app.use("/api/sales", salesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/stock-transfers", require("./routes/stockTransfer"));
app.use("/api/shifts", require("./routes/shifts"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

// Force restart trigger
console.log("🔄 Server updated");

// Start server
console.log("Calling app.listen...");
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
