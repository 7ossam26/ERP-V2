const prisma = require("./backend/config/database");

async function fixGhostShift() {
  try {
    const shiftId = 7;
    console.log(`Attempting to close ghost shift ${shiftId}...`);

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { user: true, branch: true },
    });

    if (!shift) {
      console.log("Shift not found!");
      return;
    }

    console.log(
      `Found shift: User ${shift.user.name} in Branch ${shift.branch.name} (${shift.status})`,
    );

    if (shift.status === "CLOSED") {
      console.log("Shift is already closed.");
      return;
    }

    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        status: "CLOSED",
        endTime: new Date(),
        endCash: shift.startCash, // Assuming no sales, just close it with start cash
        actualCash: shift.startCash,
        systemExpectedCash: shift.startCash,
        shortage: 0,
        reviewedById: 1, // System/Superadmin
        reviewedAt: new Date(),
      },
    });

    console.log("Successfully closed shift:", updated);
  } catch (error) {
    console.error("Error fixing shift:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixGhostShift();
