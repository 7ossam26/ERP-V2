const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const prisma = require("../config/database");
const { authenticateToken, requirePermission } = require("../middleware/auth");
const {
  getOrCreateSystemConfiguration,
  loadThemeOptions,
} = require("../lib/systemConfiguration");
const {
  ensureLogoDirectory,
  fileNameForUpload,
  validateLogoFile,
  LOGO_DIR,
  MAX_FILE_SIZE_BYTES,
} = require("../lib/logoUpload");

const router = express.Router();

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

router.use(authenticateToken);

function parseInteger(value, fallback = null) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseDecimal(value, fallback = null) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
}

function sanitizeString(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function validateTime(value, fieldLabel) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) {
    return `${fieldLabel} يجب أن يكون بصيغة HH:mm`;
  }

  return null;
}

async function ensureOwnerAccess(req, res, next) {
  const roleName = String(req.user.role || "").toLowerCase();
  if (roleName === "superadmin" || roleName === "owner") {
    return next();
  }

  return res.status(403).json({
    error: "هذه العملية متاحة للمالك فقط",
  });
}

function publicSettingsShape(config) {
  return {
    ...config,
    taxRate: Number(config.taxRate || 0),
    passwordPolicy: {
      minLength: config.passwordMinLength,
      requireUppercase: config.passwordRequireUppercase,
      requireLowercase: config.passwordRequireLowercase,
      requireNumber: config.passwordRequireNumber,
      requireSpecialChar: config.passwordRequireSpecialChar,
    },
  };
}

router.get("/", requirePermission("SETTINGS"), async (req, res, next) => {
  try {
    const config = await getOrCreateSystemConfiguration({
      includeRelations: true,
    });

    res.json(publicSettingsShape(config));
  } catch (error) {
    next(error);
  }
});

router.get("/themes", requirePermission("SETTINGS"), async (req, res, next) => {
  try {
    const themes = await loadThemeOptions();
    res.json(themes);
  } catch (error) {
    next(error);
  }
});

router.put(
  "/",
  requirePermission("SETTINGS"),
  ensureOwnerAccess,
  async (req, res, next) => {
    try {
      const themes = await loadThemeOptions();
      const allowedThemeKeys = new Set(themes.map((theme) => theme.key));

      const companyName = sanitizeString(req.body.companyName, "رامكس ستور");
      const themeKey = sanitizeString(req.body.themeKey, "ramex-store");
      const taxRate = parseDecimal(req.body.taxRate, 14);

      if (!companyName) {
        return res.status(400).json({ error: "اسم الشركة مطلوب" });
      }

      if (!allowedThemeKeys.has(themeKey)) {
        return res.status(400).json({ error: "الثيم المحدد غير معروف" });
      }

      if (taxRate < 0 || taxRate > 100) {
        return res.status(400).json({ error: "نسبة الضريبة يجب أن تكون بين 0 و100" });
      }

      const timeErrors = [
        validateTime(req.body.morningShiftStart, "بداية الوردية الصباحية"),
        validateTime(req.body.morningShiftEnd, "نهاية الوردية الصباحية"),
        validateTime(req.body.eveningShiftStart, "بداية الوردية المسائية"),
        validateTime(req.body.eveningShiftEnd, "نهاية الوردية المسائية"),
      ].filter(Boolean);

      if (timeErrors.length > 0) {
        return res.status(400).json({ error: timeErrors[0] });
      }

      const updateData = {
        companyName,
        companyNameEnglish: sanitizeString(
          req.body.companyNameEnglish,
          "Ramex Store",
        ),
        taxNumber: sanitizeString(req.body.taxNumber),
        address: sanitizeString(req.body.address),
        phone: sanitizeString(req.body.phone),
        mainWarehouseId: parseInteger(req.body.mainWarehouseId),
        mainTreasuryId: parseInteger(req.body.mainTreasuryId),
        bankTreasuryId: parseInteger(req.body.bankTreasuryId),
        taxRate,
        taxEnabledOnSales: parseBoolean(req.body.taxEnabledOnSales, true),
        taxEnabledOnPurchases: parseBoolean(
          req.body.taxEnabledOnPurchases,
          false,
        ),
        taxEnabledOnExpenses: parseBoolean(
          req.body.taxEnabledOnExpenses,
          false,
        ),
        landedCostFeatureEnabled: parseBoolean(
          req.body.landedCostFeatureEnabled,
          false,
        ),
        salaryStartDay: parseInteger(req.body.salaryStartDay, 1),
        salaryEndDay: parseInteger(req.body.salaryEndDay, 30),
        shiftStartTime: sanitizeString(req.body.shiftStartTime, "09:00"),
        shiftEndTime: sanitizeString(req.body.shiftEndTime, "17:00"),
        morningShiftStart: sanitizeString(req.body.morningShiftStart, "09:00"),
        morningShiftEnd: sanitizeString(req.body.morningShiftEnd, "17:00"),
        eveningShiftStart: sanitizeString(req.body.eveningShiftStart, "17:00"),
        eveningShiftEnd: sanitizeString(req.body.eveningShiftEnd, "01:00"),
        themeKey,
        sessionTimeoutMinutes: Math.max(
          15,
          parseInteger(req.body.sessionTimeoutMinutes, 720),
        ),
        passwordMinLength: Math.max(
          8,
          parseInteger(req.body.passwordMinLength, 8),
        ),
        passwordRequireUppercase: parseBoolean(
          req.body.passwordRequireUppercase,
          true,
        ),
        passwordRequireLowercase: parseBoolean(
          req.body.passwordRequireLowercase,
          true,
        ),
        passwordRequireNumber: parseBoolean(
          req.body.passwordRequireNumber,
          true,
        ),
        passwordRequireSpecialChar: parseBoolean(
          req.body.passwordRequireSpecialChar,
          true,
        ),
      };

      const config = await prisma.systemConfiguration.upsert({
        where: { id: 1 },
        update: updateData,
        create: {
          id: 1,
          ...updateData,
        },
        include: {
          mainWarehouse: true,
          mainTreasury: true,
          bankTreasury: true,
        },
      });

      res.json(publicSettingsShape(config));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/logo",
  requirePermission("SETTINGS"),
  ensureOwnerAccess,
  (req, res, next) => {
    logoUpload.single("logo")(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        return res.status(400).json({
          error: "فشل رفع الشعار. تأكد من حجم الملف ونوعه",
        });
      }

      if (error) {
        return next(error);
      }

      return next();
    });
  },
  async (req, res, next) => {
    try {
      const validationError = validateLogoFile(req.file);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      ensureLogoDirectory();

      const currentConfig = await getOrCreateSystemConfiguration();
      const fileName = fileNameForUpload(req.file.originalname, req.file.mimetype);
      const filePath = path.join(LOGO_DIR, fileName);
      const publicPath = `/uploads/logos/${fileName}`;

      fs.writeFileSync(filePath, req.file.buffer);

      if (currentConfig.logoUrl?.startsWith("/uploads/logos/")) {
        const previousPath = path.join(
          LOGO_DIR,
          path.basename(currentConfig.logoUrl),
        );
        if (fs.existsSync(previousPath)) {
          fs.unlinkSync(previousPath);
        }
      }

      const updatedConfig = await prisma.systemConfiguration.upsert({
        where: { id: 1 },
        update: { logoUrl: publicPath },
        create: {
          id: 1,
          logoUrl: publicPath,
        },
      });

      res.status(201).json({
        logoUrl: updatedConfig.logoUrl,
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
