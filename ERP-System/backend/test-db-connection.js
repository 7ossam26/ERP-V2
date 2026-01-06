require("dotenv").config();
const mysql = require("mysql2/promise");

async function testConnection() {
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log("✅ Successfully connected to MySQL!");

    const [rows] = await connection.execute(
      "SELECT COUNT(*) as count FROM employees"
    );
    console.log("✅ Employee table accessible. Count:", rows[0].count);

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    console.error("DATABASE_URL:", process.env.DATABASE_URL);
    process.exit(1);
  }
}

testConnection();
