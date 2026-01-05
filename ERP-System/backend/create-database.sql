-- Create the ERP System database
CREATE DATABASE IF NOT EXISTS erp 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Show databases to confirm creation
SHOW DATABASES;

-- Use the database
USE erp;

-- Show current database
SELECT DATABASE();