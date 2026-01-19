const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

console.log("--- DEBUG ENV LOADING ---");
console.log("CWD:", process.cwd());
console.log("__dirname:", __dirname);

const envRoot = path.resolve(__dirname, "../.env");
const envRootLocal = path.resolve(__dirname, "../.env.local");
const envBackend = path.resolve(__dirname, ".env");

console.log("Checking:", envRootLocal);
if (fs.existsSync(envRootLocal)) {
    console.log("FOUND Root .env.local");
    const config = dotenv.config({ path: envRootLocal, override: true });
    console.log("Loaded Root .env.local Result:", config.parsed ? "Success" : "Empty/Fail");
    console.log("DATABASE_URL AFTER LOAD:", process.env.DATABASE_URL);
} else {
    console.log("NOT FOUND Root .env.local");
}

console.log("Checking:", envBackend);
if (fs.existsSync(envBackend)) {
    console.log("FOUND Backend .env");
    // Simulate what index.js does (no override)
    dotenv.config({ path: envBackend });
    console.log("DATABASE_URL AFTER Backend .env (No Override):", process.env.DATABASE_URL);
}
