# Backend Setup Instructions

## Prerequisites

Before running the backend, ensure you have:

1. Node.js installed (v16 or higher)
2. MySQL server running locally or remotely
3. Database credentials ready

## Environment Setup

1. **Configure Database Connection**
   Edit the `.env` file and update the `DATABASE_URL` with your MySQL credentials:

   ```
   DATABASE_URL="mysql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME"
   ```

   Example:

   ```
   DATABASE_URL="mysql://root:mypassword@localhost:3306/erp_system"
   ```

2. **Create the Database**
   Before running migrations, create the database in MySQL:

   ```sql
   CREATE DATABASE erp_system;
   ```

3. **Run Prisma Migrations**
   Generate the database tables:

   ```bash
   npx prisma migrate dev --name init
   ```

   This will:

   - Create all tables defined in the schema
   - Generate the Prisma Client
   - Set up the initial migration

4. **Generate Prisma Client** (if needed separately)
   ```bash
   npx prisma generate
   ```

## Running the Server

1. **Development Mode** (with auto-reload)

   ```bash
   npm run dev
   ```

2. **Production Mode**
   ```bash
   npm start
   ```

The server will start on port 3001 (or the PORT specified in `.env`).

## Testing the API

1. **Health Check**

   ```
   GET http://localhost:3001/api/health
   ```

2. **Available Endpoints**
   - `GET/POST/PUT/DELETE /api/employees`
   - `GET/POST/PUT/DELETE /api/items`
   - `GET/POST/PUT/DELETE /api/categories`

## Database Management

- **View Database in Prisma Studio**

  ```bash
  npx prisma studio
  ```

  Opens a GUI at http://localhost:5555 to browse and edit data

- **Reset Database** (WARNING: Deletes all data)
  ```bash
  npx prisma migrate reset
  ```

## Next Steps

1. Create the remaining route files for:

   - Suppliers
   - Clients
   - Warehouses
   - Branches
   - Treasuries

2. Implement authentication with JWT

3. Add transaction endpoints for POS and reports

4. Connect the frontend to these APIs
