const prisma = require("./config/database");

async function testWarehouseModel() {
  try {
    console.log("Testing Prisma client...");
    console.log("Prisma object keys:", Object.keys(prisma));
    console.log("\nChecking for warehouse model:", "warehouse" in prisma);
    console.log("Checking for employee model:", "employee" in prisma);

    if (prisma.warehouse) {
      console.log("\nWarehouse model exists!  Testing findMany...");
      const warehouses = await prisma.warehouse.findMany();
      console.log("Warehouses:", warehouses);
    } else {
      console.log("\nERROR: Warehouse model is undefined!");
      console.log(
        "Available models:",
        Object.keys(prisma).filter(
          (k) => !k.startsWith("_") && !k.startsWith("$")
        )
      );
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testWarehouseModel();
