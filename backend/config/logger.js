/**
 * ERP-V2 Desktop — File-Based Logger
 *
 * Writes logs to {userData}/logs/app-YYYY-MM-DD.log
 * Auto-deletes logs older than 30 days on init.
 */

const fs = require("fs");
const path = require("path");

class Logger {
  constructor() {
    // Default to current directory if no path configured yet
    this.logsDir = process.env.ERP_LOGS_DIR || path.join(__dirname, "..", "logs");
    this._ensureDir();
    this._cleanOldLogs();
  }

  _ensureDir() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  _getLogFilePath() {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return path.join(this.logsDir, `app-${date}.log`);
  }

  _formatMessage(level, message) {
    const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "");
    return `[${timestamp}] [${level}] ${message}\n`;
  }

  _write(level, ...args) {
    const message = args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
      .join(" ");

    const formatted = this._formatMessage(level, message);

    try {
      fs.appendFileSync(this._getLogFilePath(), formatted);
    } catch (err) {
      // Silently fail — cannot log about a logging failure
    }
  }

  info(...args) {
    this._write("INFO", ...args);
  }

  warn(...args) {
    this._write("WARN", ...args);
  }

  error(...args) {
    this._write("ERROR", ...args);
  }

  /**
   * Delete log files older than 30 days
   */
  _cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logsDir);
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith("app-") || !file.endsWith(".log")) continue;

        const filePath = path.join(this.logsDir, file);
        const stat = fs.statSync(filePath);

        if (stat.mtimeMs < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      // Silently fail during cleanup
    }
  }
}

const logger = new Logger();

module.exports = logger;
