# Backend Migration Plan

To move from the current **Mock** setup to a **Real Backend**, you need to replace the local storage logic with actual API calls.

## 1. API Endpoints Required

You need to implement the following RESTful APIs (or GraphQL) to match your frontend services:

### Core Resources

| Service        | Data       | Expected Endpoints                       |
| :------------- | :--------- | :--------------------------------------- |
| **Auth**       | Login/User | `POST /api/login`, `GET /api/me`         |
| **Employees**  | HR & Staff | `GET, POST, PUT, DELETE /api/employees`  |
| **Suppliers**  | CRM        | `GET, POST, PUT, DELETE /api/suppliers`  |
| **Clients**    | CRM        | `GET, POST, PUT, DELETE /api/clients`    |
| **Items**      | Inventory  | `GET, POST, PUT, DELETE /api/items`      |
| **Categories** | Inventory  | `GET, POST, PUT, DELETE /api/categories` |
| **Warehouses** | Inventory  | `GET, POST, PUT, DELETE /api/warehouses` |
| **Branches**   | Management | `GET, POST, PUT, DELETE /api/branches`   |
| **Treasuries** | Finance    | `GET, POST, PUT, DELETE /api/treasuries` |

### Transactions (Missing Services)

Currently, some logic (like POS Sales) is handled locally. You need specific endpoints for these:

- **Sales/Orders**: `POST /api/orders` (To save a POS sale).
- **Transactions**: `GET /api/transactions` (For reports like "Daily Transactions").
- **HR Actions**: `POST /api/hr/advances`, `POST /api/hr/deductions`.
- **Shift Reports**: `POST /api/shifts/end` (For X/Z reports).

## 2. Recommended Stack: Express + MySQL

There is **zero conflict** between Express.js and MySQL. In fact, it is one of the most popular and stable combinations for building ERPs because:

- **Relational Data**: ERP data (Sales, Employees, Inventory) is highly relational, which MySQL handles perfectly.
- **Performance**: The `mysql2` driver for Node.js is extremely fast.
- **Ecosystem**: Huge support for ORMs like **Prisma** or **Sequelize**.

### Core Dependencies

- `express`: Web server.
- `mysql2`: Database driver.
- `access-control` (optional): For permissions.
- **ORM Recommendation**: `ؤ` (Modern, type-safe) OR `Sequelize` (Traditional, widely used).

## 3. Next Steps

1.  **Initialize Project**:
    ```bash
    mkdir backend
    cd backend
    npm init -y
    npm install express mysql2 cors dotenv
    ```
2.  **Database Design**: Create an ERD (Entity Relationship Diagram) matching the fields in `EmployeeManager`, `ItemManager`, etc.
3.  **Authentication**: Implement JWT (JSON Web Tokens) for secure login.
4.  **Connect Frontend**:
    - Go to `src/services/mockServiceFactory.js`.
    - Rewrite the functions (`getAll`, `create`, etc.) to use `fetch` or `axios` instead of `localStorage`.

## 3. What You Are "Missing"

- **Authentication Flow**: The frontend currently skips login checks. You'll need a Login Page and a Protected Route wrapper.
- **Complex Filtering**: Filtering (like "Items by Category") is currently done in JavaScript on the client side. For large data, move this to the backend (e.g., `/api/items?category_id=5`).
- **Image Uploads**: Currently using placeholder URLs. You need an endpoint to upload images and return the URL.
