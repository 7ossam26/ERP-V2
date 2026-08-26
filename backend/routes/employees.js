const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const { authenticateToken, requirePermission, requireCreatePermission, getUserBranchFilter, requireAnyPermission, requireSensitiveAccess } = require("../middleware/auth");
const { isAdminRole } = require("../config/roles");
const {
  isValidTransactionType,
  isCashOutType,
} = require("../config/employeeTransactionTypes");
const {
  summarizeEmployeeTransactions,
  computeNetSalary,
} = require("../utils/payrollMath");

// Helper to get date range for a month
const getMonthDateRange = (month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

// Manager bypass predicate — matches the frontend AuthService.hasSensitiveAccess()
// used by the HR shift gate. Admin-class roles or an explicit hasSensitiveAccess
// flag skip the "open shift required" rule.
const resolveIsManager = async (req) => {
  if (isAdminRole(req.user.role)) return true;
  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { hasSensitiveAccess: true },
  });
  return !!u?.hasSensitiveAccess;
};

// A payroll row is a FROZEN snapshot of the month it was paid for. Once it
// exists, editing or deleting one of that month's transactions would silently
// desync the snapshot from the ledger — and the pay dialog already promises the
// operator that "لن يمكن تعديل المعاملات الخاصة بهذا الشهر بعد ذلك". Nothing
// enforced it until now.
const monthIsPaid = async (employeeId, date) => {
  const paid = await prisma.payroll.findFirst({
    where: {
      employeeId,
      status: "PAID",
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    },
    select: { id: true },
  });
  return !!paid;
};

// Protect all routes with authentication
router.use(authenticateToken);

// GET all employees (with calculated current month stats)
router.get("/", requirePermission("EMPLOYEES"), async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const { startDate, endDate } = getMonthDateRange(currentMonth, currentYear);

    const branchFilter = await getUserBranchFilter(req.user.id, req);
    const whereClause = branchFilter ? { branch: branchFilter } : {};

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

    // Calculate processed fields. The same helpers back POST /:id/pay, so the
    // "المرتب المتبقي" shown here is by construction the amount that gets paid.
    const processedEmployees = employees.map((emp) => {
      const summary = summarizeEmployeeTransactions(emp.transactions);
      const baseSalary = Number(emp.salary);
      const remaining = computeNetSalary(baseSalary, summary);

      // Check if paid
      const payroll = emp.payrolls[0];
      const isPaid = payroll ? payroll.status === "PAID" : false;

      return {
        ...emp,
        salary: baseSalary,
        advances: summary.advances,
        deductions: summary.deductions,
        overtime: summary.overtime,
        bonuses: summary.bonuses,
        additions: summary.additions,
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

// POST create transaction (سلفة / خصم / اضافي / مكافئة)
router.post("/:id/transactions", requirePermission("EMPLOYEES"), async (req, res) => {
  try {
    const { type, amount, reason, date, branchId } = req.body;
    const employeeId = parseInt(req.params.id);
    const userId = req.user.id; // Capture user ID

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        error: "Reason is required",
        message: "يرجى كتابة سبب المعاملة",
      });
    }

    // Allow-list the type before touching the DB. This branch used to fall
    // through: anything that wasn't "ADVANCE" — including a typo or a type the
    // client didn't know about — was silently written as a DEDUCTION.
    if (!isValidTransactionType(type)) {
      return res.status(400).json({
        error: "Invalid transaction type",
        message: "نوع المعاملة غير صالح",
      });
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        error: "Invalid amount",
        message: "يجب إدخال مبلغ أكبر من صفر",
      });
    }

    // Resolve the branch the operation belongs to. Defaults to the chosen
    // branch (the employee's branch by default, editable on the form); falls
    // back to the employee's own branch when none is supplied.
    let resolvedBranchId = branchId ? parseInt(branchId) : null;
    if (!resolvedBranchId) {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { branchId: true },
      });
      resolvedBranchId = emp?.branchId ?? null;
    }

    // Find that branch's active shift (used to link and, for advances, to gate).
    let activeShift = null;
    if (resolvedBranchId) {
      activeShift = await prisma.shift.findFirst({
        where: {
          branchId: resolvedBranchId,
          status: { in: ["OPEN", "PENDING_REVIEW"] },
        },
        orderBy: { startTime: "desc" },
      });
    }
    const shiftId = activeShift?.id ?? null;

    // ADVANCE is the only type that moves cash: it requires an open shift on the
    // branch (non-managers), deducts the branch's cash treasury, and appears in
    // that shift's records — exactly like a cash expense.
    //
    // DEDUCTION / OVERTIME / BONUS are ACCRUALS ONLY. No cash moves when they
    // are recorded and there is no shift gate; they are settled together with
    // the salary at payout via POST /:id/pay. They still record branchId and
    // shiftId for audit attribution, but every drawer and reconciliation path
    // (routes/shifts.js, scripts/reconcile-shift-treasury.js) filters on
    // ADVANCE, so they can never affect a cash count.
    if (isCashOutType(type)) {
      const isManager = await resolveIsManager(req);

      if (!shiftId && !isManager) {
        return res.status(400).json({
          error: "لا يمكن تسجيل سلفة بدون وردية مفتوحة على نفس الفرع",
        });
      }

      const branch = resolvedBranchId
        ? await prisma.branch.findUnique({
            where: { id: resolvedBranchId },
            include: { treasury: true },
          })
        : null;

      if (!branch?.treasury) {
        return res.status(400).json({
          error: "لا توجد خزينة مرتبطة بالفرع المحدد (Branch has no treasury)",
        });
      }
      if (Number(branch.treasury.balance) < parsedAmount) {
        return res.status(400).json({
          error:
            "رصيد خزينة الفرع غير كافي لصرف السلفة (Insufficient branch treasury balance)",
        });
      }

      const transaction = await prisma.$transaction(async (tx) => {
        await tx.treasury.update({
          where: { id: branch.treasuryId },
          data: { balance: { decrement: parsedAmount } },
        });
        return tx.employeeTransaction.create({
          data: {
            employeeId,
            type,
            amount: parsedAmount,
            reason,
            date: date ? new Date(date) : new Date(),
            createdById: userId,
            branchId: resolvedBranchId,
            shiftId,
          },
        });
      });

      return res.status(201).json(transaction);
    }

    // Accrual types (DEDUCTION / OVERTIME / BONUS) — no cash movement, no shift
    // gate. Reached only by an allow-listed type; see the note above.
    const transaction = await prisma.employeeTransaction.create({
      data: {
        employeeId,
        type,
        amount: parsedAmount,
        reason, // Now guaranteed to be non-empty
        date: date ? new Date(date) : new Date(),
        createdById: userId, // Save the creator
        branchId: resolvedBranchId,
        shiftId,
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

    // Reject unknown types here rather than letting Prisma's enum validation
    // surface as a 500 from the catch below.
    if (type) {
      if (!isValidTransactionType(type)) {
        return res.status(400).json({
          error: "Invalid transaction type",
          message: "نوع المعاملة غير صالح",
        });
      }
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

// GET all payrolls / salary payments for a month (optional branch filter).
// Used by the HR monthly operations report. Two-segment path so it never
// collides with GET /:id.
router.get("/payrolls/all", async (req, res) => {
  try {
    const { month, year, branchId } = req.query;
    const where = {};

    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    if (branchId && branchId !== "all") {
      where.employee = { branchId: parseInt(branchId) };
    }

    const payrolls = await prisma.payroll.findMany({
      where,
      orderBy: { paymentDate: "desc" },
      include: {
        employee: {
          select: { id: true, name: true, branch: true },
        },
        createdBy: {
          select: { id: true, name: true, username: true },
        },
        treasury: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(payrolls);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch payrolls", message: error.message });
  }
});

// PUT update transaction
router.put("/transactions/:id", authenticateToken, async (req, res) => {
  try {
    const { amount, reason, date } = req.body;
    const transactionId = parseInt(req.params.id);

    const existing = await prisma.employeeTransaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        type: true,
        amount: true,
        branchId: true,
        employeeId: true,
        date: true,
      },
    });
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (await monthIsPaid(existing.employeeId, existing.date)) {
      return res.status(400).json({
        error: "لا يمكن تعديل معاملة بعد صرف راتب هذا الشهر",
      });
    }

    const newAmount =
      amount !== undefined && amount !== null && amount !== ""
        ? parseFloat(amount)
        : Number(existing.amount);

    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      return res.status(400).json({
        error: "Invalid amount",
        message: "يجب إدخال مبلغ أكبر من صفر",
      });
    }

    // Advances moved cash out of the branch treasury, so keep it balanced when
    // the amount changes. Legacy advances (branchId null) never moved cash, and
    // the accrual types never move cash — both skip the treasury adjustment.
    const isCashAdvance =
      isCashOutType(existing.type) && existing.branchId != null;

    const transaction = await prisma.$transaction(async (tx) => {
      if (isCashAdvance && newAmount !== Number(existing.amount)) {
        const branch = await tx.branch.findUnique({
          where: { id: existing.branchId },
          include: { treasury: true },
        });
        if (!branch?.treasury) {
          const err = new Error("لا توجد خزينة مرتبطة بالفرع");
          err.status = 400;
          throw err;
        }
        // Net effect on balance is (old − new); guard it can't go negative.
        const balanceAfterRefund =
          Number(branch.treasury.balance) + Number(existing.amount);
        if (balanceAfterRefund < newAmount) {
          const err = new Error(
            "رصيد خزينة الفرع غير كافي لتعديل السلفة (Insufficient branch treasury balance)"
          );
          err.status = 400;
          throw err;
        }
        await tx.treasury.update({
          where: { id: branch.treasuryId },
          data: { balance: { increment: Number(existing.amount) - newAmount } },
        });
      }

      return tx.employeeTransaction.update({
        where: { id: transactionId },
        data: {
          amount: amount !== undefined ? newAmount : undefined,
          reason,
          date: date ? new Date(date) : undefined,
        },
        include: { employee: { select: { id: true, name: true } } },
      });
    });

    res.json(transaction);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    res
      .status(500)
      .json({ error: "Failed to update transaction", message: error.message });
  }
});

// DELETE transaction
router.delete("/transactions/:id", authenticateToken, async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    const existing = await prisma.employeeTransaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        type: true,
        amount: true,
        branchId: true,
        employeeId: true,
        date: true,
      },
    });
    if (!existing) {
      return res.status(204).send(); // already gone — idempotent
    }

    if (await monthIsPaid(existing.employeeId, existing.date)) {
      return res.status(400).json({
        error: "لا يمكن حذف معاملة بعد صرف راتب هذا الشهر",
      });
    }

    // Refund the branch treasury for cash advances (see PUT note above).
    const isCashAdvance =
      isCashOutType(existing.type) && existing.branchId != null;

    await prisma.$transaction(async (tx) => {
      if (isCashAdvance) {
        const branch = await tx.branch.findUnique({
          where: { id: existing.branchId },
          select: { treasuryId: true },
        });
        if (branch?.treasuryId) {
          await tx.treasury.update({
            where: { id: branch.treasuryId },
            data: { balance: { increment: Number(existing.amount) } },
          });
        }
      }
      await tx.employeeTransaction.delete({ where: { id: transactionId } });
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
    const { month, year, treasuryId } = req.body;
    const userId = req.user.id;

    const { startDate, endDate } = getMonthDateRange(month, year);

    const transactions = await prisma.employeeTransaction.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const summary = summarizeEmployeeTransactions(transactions);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { branch: { include: { treasury: true } } },
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const baseSalary = Number(employee.salary);
    // base − advances − deductions + overtime + bonuses
    const netSalary = computeNetSalary(baseSalary, summary);

    // A negative net means the month's سلف + خصومات exceed base + اضافي +
    // مكافآت. This used to create a PAID payroll with a negative net, no cash
    // movement, and a permanently burned @@unique([employeeId, month, year])
    // slot — the employee read as "تم الدفع" while still owing money, with no
    // way to correct it. Reject and make the operator settle it explicitly.
    if (netSalary < 0) {
      return res.status(400).json({
        error: "صافي الراتب سالب — راجع السلف والخصومات قبل الصرف",
      });
    }

    // Resolve which treasury to debit. The HR pay dialog lets the user pick any
    // treasury in the system; when none is supplied we fall back to the
    // employee's branch treasury for backward compatibility.
    const payTreasuryId = treasuryId
      ? parseInt(treasuryId)
      : employee.branch?.treasuryId ?? null;

    // Validate treasury before deduction (only matters when cash actually moves)
    if (netSalary > 0) {
      if (!payTreasuryId) {
        return res.status(400).json({
          error: "يرجى اختيار الخزينة لدفع الراتب (No treasury selected)",
        });
      }
      const treasury = await prisma.treasury.findUnique({
        where: { id: payTreasuryId },
      });
      if (!treasury) {
        return res.status(400).json({
          error: "الخزينة المحددة غير موجودة (Selected treasury not found)",
        });
      }
      if (Number(treasury.balance) < netSalary) {
        return res.status(400).json({
          error: "رصيد الخزينة غير كافي لدفع الراتب (Insufficient treasury balance)",
        });
      }
    }

    // Salary payment is a money-out operation: require the payer's own open
    // shift (non-managers bypass gate → managers allowed). The payroll links to
    // this shift.
    const userShift = await prisma.shift.findFirst({
      where: { userId, status: { in: ["OPEN", "PENDING_REVIEW"] } },
      orderBy: { startTime: "desc" },
    });
    if (!userShift) {
      const isManager = await resolveIsManager(req);
      if (!isManager) {
        return res.status(400).json({
          error: "لا يمكن دفع الراتب بدون وردية مفتوحة",
        });
      }
    }

    // Execute payroll + treasury deduction in a single transaction
    const payroll = await prisma.$transaction(async (tx) => {
      // Deduct net salary from the chosen treasury, guarding atomically against
      // concurrent debits driving the balance negative.
      if (netSalary > 0 && payTreasuryId) {
        const debit = await tx.treasury.updateMany({
          where: { id: payTreasuryId, balance: { gte: netSalary } },
          data: { balance: { decrement: netSalary } },
        });
        if (debit.count === 0) {
          const err = new Error(
            "رصيد الخزينة غير كافي لدفع الراتب (Insufficient treasury balance)"
          );
          err.status = 400;
          throw err;
        }
      }

      // Create Payroll Record
      return await tx.payroll.create({
        data: {
          employeeId,
          month,
          year,
          baseSalary,
          advances: summary.advances,
          deductions: summary.deductions,
          overtime: summary.overtime,
          bonuses: summary.bonuses,
          netSalary,
          status: "PAID",
          paymentDate: new Date(),
          createdById: userId,
          treasuryId: payTreasuryId,
          shiftId: userShift?.id ?? null,
        },
      });
    });

    res.json(payroll);
  } catch (error) {
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Salary already paid for this month" });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
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

// PUT update employee - Requires SENSITIVE ACCESS
router.put("/:id", requireAnyPermission(["EMPLOYEES", "CREATES_EMPLOYEES"]), requireSensitiveAccess, async (req, res) => {
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

// DELETE employee - Requires SENSITIVE ACCESS
router.delete("/:id", requirePermission("EMPLOYEES"), requireSensitiveAccess, async (req, res) => {
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
