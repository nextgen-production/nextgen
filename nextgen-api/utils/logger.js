const winston = require("winston");
const chalk = require("chalk");
const moment = require("moment-timezone");
const gradient = require("gradient-string");
const Log = require("../models/log.model");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");

// Import ora dynamically
let spinner = null;
import("ora")
  .then((module) => {
    const ora = module.default;
    spinner = ora({
      text: "Processing...",
      color: "green",
    });
  })
  .catch((error) => {
    console.error("Failed to load ora:", error);
    // Fallback spinner implementation
    spinner = {
      start: () => {},
      stop: () => {},
      succeed: () => {},
      fail: () => {},
    };
  });

class Logger {
  constructor() {
    // Định nghĩa icons cho các level log
    this.icons = {
      error: "❌",
      info: "✨",
      warn: "⚠️",
      debug: "🔍",
      verbose: "📝",
    };

    // Định nghĩa màu sử dụng gradient-string
    this.colors = {
      error: (text) => gradient.passion(text),
      info: (text) => gradient.morning(text),
      warn: (text) => gradient.orange(text),
      debug: (text) => gradient.mind(text),
      verbose: (text) => gradient.cristal(text),
    };

    // Tạo format cho console
    const consoleFormat = winston.format.printf(
      ({ level, message, timestamp, ...metadata }) => {
        try {
          // Format timestamp theo múi giờ VN
          const time = moment(timestamp)
            .tz("Asia/Ho_Chi_Minh")
            .format("DD/MM/YYYY HH:mm:ss");

          // Start spinner nếu cần
          if (metadata.showSpinner && spinner) {
            spinner.start();
            setTimeout(() => spinner.stop(), 500);
          }

          // Format header với gradient color
          const header = this.colors[level](
            `━━━━━━━━━━ ${this.icons[level]} ${level.toUpperCase()} ━━━━━━━━━━`
          );

          // Format message box
          const messageBox = chalk.bold(`┃ ${message}`);

          // Format chi tiết nếu có
          let details = "";
          if (metadata.details) {
            details = "\n┃ Chi tiết:";
            Object.entries(metadata.details).forEach(([key, value]) => {
              if (value) {
                details += `\n┃  ${chalk.blue("▸")} ${chalk.gray(
                  key
                )}: ${value}`;
              }
            });
          }

          // Format metadata nếu có
          let meta = "";
          if (metadata.metadata) {
            meta = "\n┃ Metadata:";
            Object.entries(metadata.metadata).forEach(([key, value]) => {
              if (typeof value === "object") {
                meta += `\n┃  ${chalk.green("▸")} ${chalk.gray(
                  key
                )}: ${JSON.stringify(value)}`;
              } else {
                meta += `\n┃  ${chalk.green("▸")} ${chalk.gray(key)}: ${value}`;
              }
            });
          }

          // Format footer với timestamp
          const footer = chalk.gray(`━━━━━━━━━━ ${time} ━━━━━━━━━━`);

          return `\n${header}\n${messageBox}${details}${meta}\n${footer}\n`;
        } catch (error) {
          console.error("Lỗi khi format log:", error);
          return `[${level.toUpperCase()}] ${message}`;
        }
      }
    );

    // Tạo thư mục logs nếu chưa tồn tại
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    // Tạo transport cho file với daily rotation
    const fileTransport = new DailyRotateFile({
      filename: "logs/%DATE%-nextgen.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    });

    // Handle transport errors
    fileTransport.on("error", (error) => {
      console.error("Lỗi transport:", error);
    });

    // Khởi tạo winston logger
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.metadata({ fillWith: ["details", "metadata"] })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            consoleFormat
          ),
        }),
        fileTransport,
      ],
    });
  }

  // ... rest of the methods remain the same ...

  /**
   * Log error level
   */
  error(message, metadata = {}, user = null) {
    const details = this.getCallDetails();
    this.logger.error(message, { details, metadata });
    this.saveLog("error", message, details, metadata, user);
  }

  /**
   * Log info level
   */
  info(message, metadata = {}, user = null) {
    const details = this.getCallDetails();
    this.logger.info(message, { details, metadata });
    this.saveLog("info", message, details, metadata, user);
  }

  /**
   * Log warn level
   */
  warn(message, metadata = {}, user = null) {
    const details = this.getCallDetails();
    this.logger.warn(message, { details, metadata });
    this.saveLog("warn", message, details, metadata, user);
  }

  /**
   * Log debug level
   */
  debug(message, metadata = {}, user = null) {
    const details = this.getCallDetails();
    this.logger.debug(message, { details, metadata });
    this.saveLog("debug", message, details, metadata, user);
  }

  /**
   * Log verbose level
   */
  verbose(message, metadata = {}, user = null) {
    const details = this.getCallDetails();
    this.logger.verbose(message, { details, metadata });
    this.saveLog("verbose", message, details, metadata, user);
  }

  /**
   * Lưu log vào MongoDB
   */
  async saveLog(level, message, details = {}, metadata = {}, user = null) {
    try {
      await Log.create({
        level,
        message,
        details,
        metadata,
        user,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Lỗi khi lưu log vào DB:", error);
    }
  }

  /**
   * Lấy thông tin chi tiết về vị trí gọi log
   */
  getCallDetails() {
    try {
      const stack = new Error().stack;
      const callerLine = stack.split("\n")[3];
      const match = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);

      if (!match) return {};

      const [_, functionName, filePath, line, column] = match;

      return {
        functionName,
        fileName: path.basename(filePath),
        lineNumber: line,
        path: filePath,
      };
    } catch (error) {
      console.error("Lỗi khi lấy call details:", error);
      return {};
    }
  }
}

// Export singleton instance
module.exports = new Logger();
