const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const prisma = require("../config/database");

const DEFAULT_CONFIGURATION = {
  id: 1,
  companyName: "رامكس ستور",
  companyNameEnglish: "Ramex Store",
  taxNumber: "",
  address: "",
  phone: "",
  logoUrl: "",
  themeKey: "ramex-store",
  taxRate: 14,
  taxEnabledOnSales: true,
  taxEnabledOnPurchases: false,
  taxEnabledOnExpenses: false,
  landedCostFeatureEnabled: false,
  salaryStartDay: 1,
  salaryEndDay: 30,
  shiftStartTime: "09:00",
  shiftEndTime: "17:00",
  morningShiftStart: "09:00",
  morningShiftEnd: "17:00",
  eveningShiftStart: "17:00",
  eveningShiftEnd: "01:00",
  sessionTimeoutMinutes: 720,
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumber: true,
  passwordRequireSpecialChar: true,
};

async function getOrCreateSystemConfiguration({ includeRelations = false } = {}) {
  const include = includeRelations
    ? {
        mainWarehouse: true,
        mainTreasury: true,
        bankTreasury: true,
      }
    : undefined;

  let config = await prisma.systemConfiguration.findFirst({
    where: { id: 1 },
    include,
  });

  if (!config) {
    config = await prisma.systemConfiguration.create({
      data: DEFAULT_CONFIGURATION,
      include,
    });
  }

  return config;
}

async function loadThemeOptions() {
  const themeFilePath = path.resolve(
    __dirname,
    "../../frontend/src/theme/themes.js",
  );

  if (!fs.existsSync(themeFilePath)) {
    return [];
  }

  const themeModule = await import(pathToFileURL(themeFilePath).href);
  return themeModule.themeOptions || themeModule.default || [];
}

function describePasswordPolicy(config) {
  return {
    minLength: config.passwordMinLength,
    requireUppercase: config.passwordRequireUppercase,
    requireLowercase: config.passwordRequireLowercase,
    requireNumber: config.passwordRequireNumber,
    requireSpecialChar: config.passwordRequireSpecialChar,
  };
}

function validatePasswordAgainstPolicy(password, policy) {
  if (!password || password.length < policy.minLength) {
    return `كلمة المرور يجب ألا تقل عن ${policy.minLength} أحرف`;
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على حرف إنجليزي كبير واحد على الأقل";
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على حرف إنجليزي صغير واحد على الأقل";
  }

  if (policy.requireNumber && !/\d/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل";
  }

  if (policy.requireSpecialChar && !/[^A-Za-z0-9]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل";
  }

  return null;
}

module.exports = {
  DEFAULT_CONFIGURATION,
  describePasswordPolicy,
  getOrCreateSystemConfiguration,
  loadThemeOptions,
  validatePasswordAgainstPolicy,
};
