const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, requireCreatePermission, getUserBranchFilter, requireAnyPermission } = require("../middleware/auth");

// Helper to get date range for a month
const getMonthDateRange = (month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

// Protect all routes with authentication
router.use(authenticateToken);

// GET all employees (with calculated current month stats)
router.get("/", async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const { startDate, endDate } = getMonthDateRange(currentMonth, currentYear);

    const branchId = await getUserBranchFilter(req.user.id);
    const whereClause = branchId ? { branchId } : {};

    const employees = await prisma.employee.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        branch: true,
        transactions: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            createdBy: {
              select: { id: true, name: true, username: true },
            },
          },
        },
        payrolls: {
          where: {
            month: currentMonth,
            year: currentYear,
          },
          include: {
            createdBy: {
              select: { id: true, name: true, username: true },
            },
          },
        },
      },
    });

    // Calculate processed fields
    const processedEmployees = employees.map((emp) => {
      const advances = emp.transactions
        .filter((t) => t.type === "ADVANCE")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const deductions = emp.transactions
        .filter((t) => t.type === "DEDUCTION")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const baseSalary = Number(emp.salary);
      const remaining = baseSalary - advances - deductions;

      // Check if paid
      const payroll = emp.payrolls[0];
      const isPaid = payroll ? payroll.status === "PAID" : false;

      return {
        ...emp,
        salary: baseSalary,
        advances,
        deductions,
        remaining,
        isPaid,
        payrollId: payroll?.id,
        paidBy: payroll?.createdBy?.name, // Add paidBy name
      };
    });

    res.json(processedEmployees);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch employees", message: error.message });
  }
});

// GET employee by ID
router.get("/:id", async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        branch: true,
        transactions: {
          orderBy: { date: "desc" },
          include: {
            createdBy: {
              select: { id: true, name: true, username: true },
            },
          },
        },
        payrolls: {
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: {
              select: { id: true, name: true, username: true },
            },
          },
        },
      },
    });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json(employee);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch employee", message: error.message });
  }
});

// POST create transaction (Advance/Deduction)
router.post("/:id/transactions", authenticateToken, async (req, res) => {
  try {
    const { type, amount, reason, date } = req.body;
    const employeeId = parseInt(req.params.id);
    const userId = req.user.id; // Capture user ID

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        error: "Reason is required",
        message: "يرجى كتابة سبب المعاملة",
      });
    }

    const transaction = await prisma.employeeTransaction.create({
      data: {
        employeeId,
        type,
        amount: parseFloat(amount),
        reason, // Now guaranteed to be non-empty
        date: date ? new Date(date) : new Date(),
        createdById: userId, // Save the creator
      },
    });

    res.status(201).json(transaction);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create transaction", message: error.message });
  }
});

// GET all transactions (globally, with optional filters)
router.get("/transactions/all", async (req, res) => {
  try {
    const { type, startDate, endDate, branchId } = req.query;
    const where = {};

    if (type) {
      where.type = type;
    }

    if (branchId && branchId !== "all") {
      where.employee = {
        branchId: parseInt(branchId),
      };
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const transactions = await prisma.employeeTransaction.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        employee: {
          select: { id: true, name: true, branch: true },
        },
        createdBy: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    res.json(transactions);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch transactions", message: error.message });
  }
});

// PUT update transaction
router.put("/transactions/:id", authenticateToken, async (req, res) => {
  try {
    const { amount, reason, date } = req.body;
    const transactionId = parseInt(req.params.id);

    const transaction = await prisma.employeeTransaction.update({
      where: { id: transactionId },
      data: {
        amount: amount ? parseFloat(amount) : undefined,
        reason,
        date: date ? new Date(date) : undefined,
      },
      include: {
        employee: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(transaction);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update transaction", message: error.message });
  }
});

// DELETE transaction
router.delete("/transactions/:id", authenticateToken, async (req, res) => {
  try {
    await prisma.employeeTransaction.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete transaction", message: error.message });
  }
});

// POST Pay Salary
router.post("/:id/pay", authenticateToken, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const { month, year } = req.body;
    const userId = req.user.id; // Capture user ID

    // Calculate current stats
    const { startDate, endDate } = getMonthDateRange(month, year);

    const transactions = await prisma.employeeTransaction.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const advances = transactions
      .filter((t) => t.type === "ADVANCE")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const deductions = transactions
      .filter((t) => t.type === "DEDUCTION")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    const baseSalary = Number(employee.salary);
    const netSalary = baseSalary - advances - deductions;

    // Create Payroll Record
    const payroll = await prisma.payroll.create({
      data: {
        employeeId,
        month,
        year,
        baseSalary,
        advances,
        deductions,
        netSalary,
        status: "PAID",
        paymentDate: new Date(),
        createdById: userId, // Save the creator
      },
    });

    res.json(payroll);
  } catch (error) {
    // Handle unique constraint (already paid)
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Salary already paid for this month" });
    }
    res
      .status(500)
      .json({ error: "Failed to process payroll", message: error.message });
  }
});

// POST create new employee
router.post("/", requireCreatePermission("CREATES_EMPLOYEES"), async (req, res) => {
  try {
    const {
      name,
      position,
      branchId,
      branch, // Ignore legacy field
      phoneNumber,
      nationalId,
      workingDaysPerMonth,
      workingHoursPerDay,
      weeklyHoliday,
      salary,
    } = req.body;

    console.log("POST /api/employees - Request Body:", req.body);
    console.log("branchId received:", branchId, "Type:", typeof branchId);

    if (!branchId || isNaN(parseInt(branchId))) {
      return res.status(400).json({
        error: "Branch is required",
        message: "Please select a valid branch",
      });
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        position,
        branchId: parseInt(branchId),
        phoneNumber,
        nationalId,
        workingDaysPerMonth: parseInt(workingDaysPerMonth),
        workingHoursPerDay: parseFloat(workingHoursPerDay),
        weeklyHoliday,
        salary: parseFloat(salary),
      },
      include: {
        branch: true,
      },
    });
    res.status(201).json(employee);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create employee", message: error.message });
  }
});

// PUT update employee
router.put("/:id", requireAnyPermission(["EMPLOYEES", "CREATES_EMPLOYEES"]), async (req, res) => {
  try {
    const {
      name,
      position,
      branchId,
      branch, // Ignore legacy field
      phoneNumber,
      nationalId,
      workingDaysPerMonth,
      workingHoursPerDay,
      weeklyHoliday,
      salary,
    } = req.body;

    if (branchId && isNaN(parseInt(branchId))) {
      return res.status(400).json({
        error: "Invalid Branch ID",
        message: "Branch ID must be a number",
      });
    }

    const employee = await prisma.employee.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        position,
        branchId: parseInt(branchId),
        phoneNumber,
        nationalId,
        workingDaysPerMonth: parseInt(workingDaysPerMonth),
        workingHoursPerDay: parseFloat(workingHoursPerDay),
        weeklyHoliday,
        salary: parseFloat(salary),
      },
      include: {
        branch: true,
      },
    });
    res.json(employee);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update employee", message: error.message });
  }
});

// DELETE employee
router.delete("/:id", requirePermission("EMPLOYEES"), async (req, res) => {
  try {
    await prisma.employee.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete employee", message: error.message });
  }
});

module.exports = router;
