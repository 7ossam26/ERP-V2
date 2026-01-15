const { Prisma } = require("@prisma/client");

/**
 * Global Error Handler Middleware
 *
 * This middleware intercepts errors from all routes, sanitizes them,
 * and ensures that sensitive database details are not leaked to the client.
 */
const errorHandler = (err, req, res, next) => {
    // Log the full error for server-side debugging
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);

    // Default error response
    let statusCode = 500;
    let message = "Something went wrong. Please try again later.";
    let error = "Internal Server Error";

    // Handle Prisma Database Errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        statusCode = 400; // Bad Request for data validation issues
        error = "Database validation error";

        switch (err.code) {
            case "P2002":
                // Unique constraint violation
                // data.target is usually an array of field names
                const field = err.meta?.target ? `(${err.meta.target})` : "";
                message = `This value is already in use ${field}. Please use a unique value.`;
                break;

            case "P2003":
                // Foreign key constraint violation
                message =
                    "Cannot complete this action because this record is associated with other data (e.g., branches, products, or transactions).";
                break;

            case "P2025":
                // Record not found
                statusCode = 404;
                error = "Not Found";
                message = "The requested record was not found.";
                break;

            default:
                // Other Prisma errors - keep generic message but log code
                console.error(`Unhandled Prisma Error Code: ${err.code}`);
                message = "A database constraint violation occurred.";
        }
    } else if (err.name === "ValidationError") {
        // Handle other validation libraries if added later
        statusCode = 400;
        error = "Validation Error";
        message = err.message;
    } else if (err.status) {
        // Respect manually thrown errors with status codes
        statusCode = err.status;
        message = err.message;
        error = err.error || "Application Error";
    }

    // Send sanitized response
    res.status(statusCode).json({
        error,
        message,
        // Only include code in development for easier debugging if needed
        ...(process.env.NODE_ENV === "development" && { code: err.code }),
    });
};

module.exports = errorHandler;
