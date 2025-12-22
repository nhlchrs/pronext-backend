import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, "app.log");
const errorLogFile = path.join(logsDir, "error.log");
const auditLogFile = path.join(logsDir, "audit.log");

// Helper function to write to log file
const writeLog = (message, logFilePath) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
};

/**
 * Request logging middleware
 * Logs all incoming requests with method, URL, status, response time
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Capture the original send function
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - startTime;
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;
    const userId = req.user?._id || "anonymous";
    const userAgent = req.headers["user-agent"];

    const logMessage = `${method} ${url} - Status: ${status} - Duration: ${duration}ms - User: ${userId} - IP: ${req.ip}`;
    console.log(logMessage);
    writeLog(logMessage, logFile);

    // Call the original send function
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Error logging middleware
 * Logs all errors with stack trace
 */
export const errorLogger = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const userId = req.user?._id || "anonymous";
  const method = req.method;
  const url = req.originalUrl;

  const errorMessage = `
    ================================
    [${timestamp}] ERROR OCCURRED
    ================================
    User: ${userId}
    Method: ${method}
    URL: ${url}
    Error: ${err.message}
    Stack: ${err.stack}
    IP: ${req.ip}
    ================================
  `;

  console.error(errorMessage);
  writeLog(errorMessage, errorLogFile);

  // Send error response
  res.status(err.status || 500).json({
    status: 0,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    error: process.env.NODE_ENV === "development" ? err : undefined,
  });
};

/**
 * Audit logging middleware
 * Logs sensitive admin actions
 */
export const auditLogger = (action, userId, targetUserId, details) => {
  const timestamp = new Date().toISOString();

  const auditMessage = `[${timestamp}] ACTION: ${action} | Admin: ${userId} | Target: ${targetUserId} | Details: ${JSON.stringify(
    details
  )}`;

  console.log(`[AUDIT] ${auditMessage}`);
  writeLog(auditMessage, auditLogFile);
};

/**
 * Middleware to log admin actions
 * Attach this to admin routes
 */
export const auditLoggingMiddleware = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    const userId = req.user?._id;
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;

    // Log admin actions (POST, PUT, DELETE)
    if (["POST", "PUT", "DELETE"].includes(method) && userId) {
      auditLogger(`${method} ${url}`, userId, req.params.userId || req.body.userId || "N/A", {
        body: req.body,
        params: req.params,
        status,
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Performance monitoring middleware
 * Tracks slow requests
 */
export const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const threshold = 3000; // Log if request takes more than 3 seconds

    if (duration > threshold) {
      const slowRequestMessage = `SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`;
      console.warn(slowRequestMessage);
      writeLog(`[SLOW] ${slowRequestMessage}`, logFile);
    }
  });

  next();
};

export default { requestLogger, errorLogger, auditLogger, auditLoggingMiddleware, performanceMonitor };
