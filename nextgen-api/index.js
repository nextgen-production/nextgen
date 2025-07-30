const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const logger = require("./utils/logger");

// Import routes
const authentucationRouter = require("./routers/auththentication.router");
const usersRouter = require("./routers/users.router");
const bannerRoutes = require("./routers/banners.router");
const categoriesRouter = require("./routers/categories.router");
const productsRouter = require("./routers/products.router");

// Constants
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const UPLOAD_DIRS = ["banners", "products"];

// Initialize Express app
const app = express();

// Create upload directories
UPLOAD_DIRS.forEach((dir) => {
  const dirPath = path.join(__dirname, "uploads", dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Tạo thư mục upload: ${dir}`);
  }
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.info("Kết nối MongoDB thành công", {
      uri: process.env.MONGO_URI?.split("@")[1], // Log only host part
    });
  })
  .catch((err) => {
    logger.error("Lỗi kết nối MongoDB", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1); // Exit if cannot connect to database
  });

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use("/uploads", express.static("uploads"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Request logging middleware
// app.use((req, res, next) => {
//   logger.info("Incoming request", {
//     path: req.path,
//     method: req.method,
//     ip: req.ip,
//     userAgent: req.get("user-agent"),
//   });
//   next();
// });

// Routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "NextGen API Server",
    version: "1.0.0",
  });
});

// API routes
app.use("/api/auth", authentucationRouter);
app.use("/api/users", usersRouter);
app.use("/api/banners", bannerRoutes);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);

// 404 handler
app.use((req, res) => {
  logger.warn("Route không tồn tại", {
    path: req.path,
    method: req.method,
  });
  res.status(404).json({
    success: false,
    message: "Route không tồn tại",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error("Lỗi server", {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server đang chạy tại port ${PORT}`, {
    environment: process.env.NODE_ENV,
    frontendUrl: FRONTEND_URL,
  });
});

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection:", {
    reason: reason,
    promise: promise,
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
