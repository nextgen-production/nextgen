const User = require("../models/user.model");
const logger = require("../utils/logger");

/**
 * Lấy thông tin cá nhân của user đang đăng nhập
 */
exports.getProfile = async (req, res) => {
  try {
    logger.info("Bắt đầu lấy thông tin cá nhân", {
      userId: req.user?._id,
    });

    const user = await User.findById(req.user._id).select(
      "-password -verificationCode -verificationCodeValidation"
    );

    if (!user) {
      logger.warn("Không tìm thấy thông tin người dùng", {
        userId: req.user._id,
      });
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng",
      });
    }

    logger.info("Lấy thông tin cá nhân thành công", {
      userId: user._id,
      email: user.email,
    });

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin cá nhân", {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

/**
 * Lấy danh sách tất cả users (Admin only)
 */
exports.getAllUsers = async (req, res) => {
  try {
    logger.info("Bắt đầu lấy danh sách người dùng", {
      adminId: req.user._id,
    });

    const users = await User.find()
      .select("-password -verificationCode -verificationCodeValidation")
      .sort("-createdAt");

    logger.info("Lấy danh sách người dùng thành công", {
      count: users.length,
      adminId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách người dùng", {
      adminId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

/**
 * Lấy thông tin chi tiết một user (Admin only)
 */
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Bắt đầu lấy thông tin người dùng", {
      userId: id,
      adminId: req.user._id,
    });

    const user = await User.findById(id).select(
      "-password -verificationCode -verificationCodeValidation"
    );

    if (!user) {
      logger.warn("Không tìm thấy người dùng", {
        userId: id,
        adminId: req.user._id,
      });
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    logger.info("Lấy thông tin người dùng thành công", {
      userId: id,
      adminId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin người dùng", {
      userId: req.params.id,
      adminId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

/**
 * Cập nhật thông tin user (Admin only)
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, email, isAdmin, isVerified, wallet } = req.body;

    logger.info("Bắt đầu cập nhật thông tin người dùng", {
      userId: id,
      adminId: req.user._id,
      updates: req.body,
    });

    // Validate email if provided
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: id },
      });
      if (existingUser) {
        logger.warn("Email đã tồn tại", {
          email,
          userId: id,
          adminId: req.user._id,
        });
        return res.status(400).json({
          success: false,
          message: "Email đã được sử dụng bởi tài khoản khác",
        });
      }
    }

    // Build update data
    const updateData = {
      fullname,
      email,
      isAdmin,
      isVerified,
      wallet: Number(wallet),
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password -verificationCode -verificationCodeValidation");

    if (!user) {
      logger.warn("Không tìm thấy người dùng", {
        userId: id,
        adminId: req.user._id,
      });
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    logger.info("Cập nhật thông tin người dùng thành công", {
      userId: id,
      adminId: req.user._id,
      updates: updateData,
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin người dùng thành công",
      data: user,
    });
  } catch (error) {
    logger.error("Lỗi khi cập nhật thông tin người dùng", {
      userId: req.params.id,
      adminId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

/**
 * Xóa user (Admin only)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info("Bắt đầu xóa người dùng", {
      userId: id,
      adminId: req.user._id,
    });

    // Không cho phép admin tự xóa chính mình
    if (id === req.user._id.toString()) {
      logger.warn("Admin không thể tự xóa tài khoản của mình", {
        adminId: req.user._id,
      });
      return res.status(400).json({
        success: false,
        message: "Bạn không thể xóa tài khoản của chính mình",
      });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      logger.warn("Không tìm thấy người dùng", {
        userId: id,
        adminId: req.user._id,
      });
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    logger.info("Xóa người dùng thành công", {
      userId: id,
      email: user.email,
      adminId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: "Xóa người dùng thành công",
    });
  } catch (error) {
    logger.error("Lỗi khi xóa người dùng", {
      userId: req.params.id,
      adminId: req.user?._id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};
