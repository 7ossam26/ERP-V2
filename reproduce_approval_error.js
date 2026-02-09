const prisma = require("./backend/config/database");
const bcrypt = require("bcryptjs");

async function reproduceApprovalError() {
  try {
    const shiftId = 20;
    const managerUsername = "man2";
    const managerPassword = "123"; // Assuming a test password, or I'll try to find the hash if this fails

    console.log(
      `Attempting to approve shift ${shiftId} with user ${managerUsername}...`,
    );

    // 1. Fetch Shift
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { branch: true },
    });

    if (!shift) {
      console.log("Shift not found!");
      return;
    }
    console.log(
      `Shift found: status=${shift.status}, branchId=${shift.branchId}`,
    );

    // 2. Fetch Manager
    const manager = await prisma.user.findUnique({
      where: { username: managerUsername },
      include: {
        role: true,
        accessibleBranches: {
          select: { id: true },
        },
      },
    });

    if (!manager) {
      console.log("Manager not found!");
      return;
    }
    console.log(
      `Manager found: id=${manager.id}, role=${manager.role.name}, branchId=${manager.branchId}`,
    );
    console.log("Manager accessible branches:", manager.accessibleBranches);

    // 3. Simulate Logic from shifts.js

    // Check Status
    if (shift.status !== "PENDING_REVIEW") {
      console.log(`ERROR: Cannot approve shift with status: ${shift.status}`);
    }

    // Check Pending Deliveries
    const pendingDeliveryOrders = await prisma.sale.count({
      where: {
        shiftId: shiftId,
        deliveryStatus: "OUT_FOR_DELIVERY",
      },
    });
    console.log(`Pending delivery orders: ${pendingDeliveryOrders}`);

    // Check Branch Access
    const canAccessBranch =
      manager.branchId === shift.branchId ||
      (manager.accessibleBranches &&
        manager.accessibleBranches.some((b) => b.id === shift.branchId)) ||
      manager.role.name === "Superadmin";

    console.log(`Can access branch? ${canAccessBranch}`);
    if (!canAccessBranch) {
      console.log(
        "ERROR: Access denied. You do not have permission to manage this branch.",
      );
      console.log(
        `Details: Manager Branch=${manager.branchId}, Shift Branch=${shift.branchId}`,
      );
    }

    // Check Role Authorization
    const isAuthorized =
      manager.role.name === "Superadmin" ||
      manager.role.name === "Manager" ||
      manager.role.name === "Branch Manager" ||
      manager.role.name === "Admin" ||
      manager.role.name === "General Manager";

    console.log(`Is authorized role? ${isAuthorized} (${manager.role.name})`);
  } catch (error) {
    console.error("Error in reproduction script:", error);
  } finally {
    await prisma.$disconnect();
  }
}

reproduceApprovalError();
