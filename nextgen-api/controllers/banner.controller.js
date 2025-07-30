const Banner = require("../models/banner.model");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

// Định nghĩa constants
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "banners");
const DEFAULT_ORDER = 0;
const DEFAULT_TITLE = "Banner";

/**
 * Xử lý upload banner mới
 */
exports.uploadBanner = async (req, res) => {
  try {
    logger.info("Bắt đầu xử lý upload banner");

    // Validate file upload
    if (!req.file) {
      logger.warn("Không tìm thấy file upload");
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn hình ảnh để tải lên",
      });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      logger.warn("File không đúng định dạng", {
        mimetype: req.file.mimetype,
      });
      return res.status(400).json({
        success: false,
        message: "Chỉ chấp nhận file ảnh định dạng JPG, PNG hoặc WEBP",
      });
    }

    const imagePath = `/uploads/banners/${req.file.filename}`;

    // Create new banner
    const newBanner = await Banner.create({
      image: imagePath,
      title: req.body.title || DEFAULT_TITLE,
      order: parseInt(req.body.order) || DEFAULT_ORDER,
      isActive: true,
    });

    logger.info("Upload banner thành công", {
      bannerId: newBanner._id,
      filename: req.file.filename,
    });

    return res.status(201).json({
      success: true,
      message: "Tải lên banner thành công",
      data: newBanner,
    });
  } catch (error) {
    logger.error("Lỗi khi upload banner", {
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
 * Xử lý xóa banner
 */
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Bắt đầu xử lý xóa banner", { bannerId: id });

    const banner = await Banner.findById(id);
    if (!banner) {
      logger.warn("Không tìm thấy banner", { bannerId: id });
      return res.status(404).json({
        success: false,
        message: "Banner không tồn tại",
      });
    }

    // Xóa file ảnh
    const relativePath = banner.image.replace(/^\//, "");
    const imagePath = path.join(__dirname, "..", relativePath);

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      logger.info("Đã xóa file ảnh banner", {
        bannerId: id,
        path: relativePath,
      });
    }

    // Xóa banner từ database
    await Banner.findByIdAndDelete(id);

    logger.info("Xóa banner thành công", { bannerId: id });

    return res.status(200).json({
      success: true,
      message: "Xóa banner thành công",
    });
  } catch (error) {
    logger.error("Lỗi khi xóa banner", {
      error: error.message,
      stack: error.stack,
      bannerId: req.params.id,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

/**
 * Lấy danh sách banner đang hoạt động
 */
exports.getBanners = async (req, res) => {
  try {
    logger.info("Bắt đầu lấy danh sách banner");

    const banners = await Banner.find({ isActive: true })
      .sort({ order: 1 })
      .select("-__v");

    logger.info("Lấy danh sách banner thành công", {
      count: banners.length,
    });

    return res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách banner", {
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
 * Cập nhật thông tin banner
 */
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Bắt đầu cập nhật banner", { bannerId: id });

    const banner = await Banner.findById(id);
    if (!banner) {
      logger.warn("Không tìm thấy banner", { bannerId: id });
      return res.status(404).json({
        success: false,
        message: "Banner không tồn tại",
      });
    }

    const updateData = {
      title: req.body.title,
      order: parseInt(req.body.order),
      isActive: req.body.isActive,
    };

    // Chỉ cập nhật các trường có giá trị
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    const updatedBanner = await Banner.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    logger.info("Cập nhật banner thành công", {
      bannerId: id,
      updates: updateData,
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật banner thành công",
      data: updatedBanner,
    });
  } catch (error) {
    logger.error("Lỗi khi cập nhật banner", {
      error: error.message,
      stack: error.stack,
      bannerId: req.params.id,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};
