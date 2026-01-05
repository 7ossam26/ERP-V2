// Simple MySQL connection test using mysql2 directly
const mysql = require("mysql2/promise");
require("dotenv").config();

async function testMySQLConnection() {
  console.log("🔍 Testing MySQL connection...\n");

  // Parse DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  console.log("📋 DATABASE_URL:", dbUrl?.replace(/:[^:@]+@/, ":****@")); // Hide password

  if (!dbUrl) {
    console.error("❌ DATABASE_URL not found in .env file");
    return;
  }

  // Parse the connection URL
  const urlPattern = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = dbUrl.match(urlPattern);

  if (!match) {
    console.error("❌ Invalid DATABASE_URL format");
    console.log(
      "   Expected format: mysql://username:password@host:port/database"
    );
    return;
  }

  const [, user, password, host, port, database] = match;

  console.log("\n📊 Connection details:");
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   User: ${user}`);
  console.log(`   Database: ${database}`);
  console.log("");

  try {
    // Try to connect
    console.log("🔌 Connecting to MySQL server...");
    const connection = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password,
    });

    console.log("✅ Connected to MySQL server!\n");

    // Check if database exists
    console.log(`🔍 Checking if database '${database}' exists...`);
    const [databases] = await connection.query("SHOW DATABASES LIKE ?", [
      database,
    ]);

    if (databases.length === 0) {
      console.log(`⚠️  Database '${database}' does not exist`);
      console.log("\n💡 Creating database...");

      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      console.log(`✅ Database '${database}' created successfully!`);
    } else {
      console.log(`✅ Database '${database}' exists!`);
    }

    // Test connection to the database
    console.log(`\n🔌 Connecting to database '${database}'...`);
    await connection.query(`USE \`${database}\``);

    // Run a test query
    const [result] = await connection.query("SELECT 1 + 1 AS result");
    console.log("✅ Test query successful:", result);

    // Show tables
    const [tables] = await connection.query("SHOW TABLES");
    console.log(`\n📋 Tables in database (${tables.length}):`);
    if (tables.length === 0) {
      console.log("   (no tables yet - run migrations to create them)");
    } else {
      tables.forEach((table) => console.log(`   - ${Object.values(table)[0]}`));
    }

    await connection.end();
    console.log("\n✅ All connection tests passed!");
    console.log("\n📝 Next steps:");
    console.log("   1. Run: npx prisma generate");
    console.log("   2. Run: npx prisma migrate dev --name init");
    console.log("   3. Run: npm run dev");
  } catch (error) {
    console.error("\n❌ Connection test failed!");
    console.error("Error:", error.message);
    console.error("\n💡 Possible solutions:");
    console.error("   1. Make sure MySQL server is running");
    console.error("   2. Check your MySQL credentials in .env");
    console.error("   3. Verify the host and port are correct");
    console.error("   4. Ensure the MySQL user has proper permissions");
  }
}

testMySQLConnection();
