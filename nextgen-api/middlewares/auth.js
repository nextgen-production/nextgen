const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const logger = require("../utils/logger");

exports.verifyToken = async (req, res, next) => {
  try {
    logger.info("Bắt đầu xác thực token");

    const cookieToken = req.cookies.Authorization;
    const token = cookieToken?.split(" ")[1]; // Remove "Bearer " prefix

    if (!token) {
      logger.warn("Không tìm thấy token xác thực", {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện thao tác này",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId).select("-password");

    if (!req.user) {
      logger.warn("Token không hợp lệ - Không tìm thấy user", {
        userId: decoded.userId,
        path: req.path,
        method: req.method,
      });
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại",
      });
    }

    logger.info("Xác thực token thành công", {
      userId: req.user._id,
      email: req.user.email,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    logger.error("Lỗi xác thực token", {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    let message = "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại";
    if (error.name === "TokenExpiredError") {
      message = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại";
    }

    return res.status(401).json({
      success: false,
      message,
    });
  }
};

exports.verifyAdmin = async (req, res, next) => {
  try {
    logger.info("Kiểm tra quyền admin", {
      userId: req.user._id,
      path: req.path,
      method: req.method,
    });

    if (!req.user.isAdmin) {
      logger.warn("Truy cập bị từ chối - Không có quyền admin", {
        userId: req.user._id,
        email: req.user.email,
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    logger.info("Xác thực quyền admin thành công", {
      userId: req.user._id,
      email: req.user.email,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    logger.error("Lỗi khi kiểm tra quyền admin", {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thực hiện thao tác này",
    });
  }
};
