const Category = require("../models/category.model");
const logger = require("../utils/logger");

/**
 * Lấy danh sách danh mục theo cấu trúc phân cấp
 */
exports.getAllCategories = async (req, res) => {
  try {
    logger.info("Bắt đầu lấy danh sách danh mục");

    const categories = await Category.find({ isActive: true })
      .sort({ order: 1 })
      .select("-__v");

    // Chuyển đổi thành cấu trúc phân cấp
    const rootCategories = categories.filter((cat) => !cat.parent);
    const hierarchicalCategories = rootCategories.map((root) => ({
      ...root._doc,
      children: categories
        .filter((cat) => cat.parent?.toString() === root._id.toString())
        .map((child) => ({
          ...child._doc,
          parent: undefined, // Loại bỏ thông tin parent không cần thiết
        })),
    }));

    logger.info("Lấy danh sách danh mục thành công", {
      totalCategories: categories.length,
      rootCategories: rootCategories.length,
    });

    return res.status(200).json({
      success: true,
      data: hierarchicalCategories,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách danh mục", {
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
 * Lấy thông tin chi tiết một danh mục
 */
exports.getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Bắt đầu lấy thông tin danh mục", { categoryId: id });

    const category = await Category.findById(id).select("-__v");
    if (!category) {
      logger.warn("Không tìm thấy danh mục", { categoryId: id });
      return res.status(404).json({
        success: false,
        message: "Danh mục không tồn tại",
      });
    }

    // Nếu là danh mục cha, lấy thêm danh sách con
    const children = await Category.find({
      parent: category._id,
      isActive: true,
    }).select("-__v");

    const responseData = {
      ...category._doc,
      children: children.map((child) => ({
        ...child._doc,
        parent: undefined,
      })),
    };

    logger.info("Lấy thông tin danh mục thành công", {
      categoryId: id,
      childCount: children.length,
    });

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin danh mục", {
      categoryId: req.params.id,
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
 * Tạo danh mục mới
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, icon, parent, order } = req.body;
    logger.info("Bắt đầu tạo danh mục mới", { name, parent });

    // Kiểm tra parent nếu có
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        logger.warn("Danh mục cha không tồn tại", { parentId: parent });
        return res.status(404).json({
          success: false,
          message: "Danh mục cha không tồn tại",
        });
      }
    }

    // Tạo danh mục mới
    const newCategory = await Category.create({
      name,
      icon,
      parent,
      order: order || 0,
      isActive: true,
    });

    logger.info("Tạo danh mục thành công", {
      categoryId: newCategory._id,
      name: newCategory.name,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo danh mục thành công",
      data: newCategory,
    });
  } catch (error) {
    logger.error("Lỗi khi tạo danh mục", {
      categoryData: req.body,
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
 * Cập nhật thông tin danh mục
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, parent, order, isActive } = req.body;

    logger.info("Bắt đầu cập nhật danh mục", {
      categoryId: id,
      updates: req.body,
    });

    // Kiểm tra parent nếu có
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        logger.warn("Danh mục cha không tồn tại", { parentId: parent });
        return res.status(404).json({
          success: false,
          message: "Danh mục cha không tồn tại",
        });
      }

      // Kiểm tra không cho phép chọn chính nó làm cha
      if (parent === id) {
        logger.warn("Không thể chọn chính danh mục làm cha", {
          categoryId: id,
        });
        return res.status(400).json({
          success: false,
          message: "Không thể chọn chính danh mục này làm danh mục cha",
        });
      }
    }

    const updateData = {
      name,
      icon,
      parent,
      order,
      isActive,
    };

    // Chỉ cập nhật các trường có giá trị
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    const updatedCategory = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedCategory) {
      logger.warn("Không tìm thấy danh mục", { categoryId: id });
      return res.status(404).json({
        success: false,
        message: "Danh mục không tồn tại",
      });
    }

    logger.info("Cập nhật danh mục thành công", {
      categoryId: id,
      updates: updateData,
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật danh mục thành công",
      data: updatedCategory,
    });
  } catch (error) {
    logger.error("Lỗi khi cập nhật danh mục", {
      categoryId: req.params.id,
      updates: req.body,
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
 * Xóa danh mục
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Bắt đầu xóa danh mục", { categoryId: id });

    // Kiểm tra danh mục con
    const hasChildren = await Category.exists({ parent: id });
    if (hasChildren) {
      logger.warn("Không thể xóa danh mục có danh mục con", { categoryId: id });
      return res.status(400).json({
        success: false,
        message: "Vui lòng xóa các danh mục con trước khi xóa danh mục này",
      });
    }

    const deletedCategory = await Category.findByIdAndDelete(id);
    if (!deletedCategory) {
      logger.warn("Không tìm thấy danh mục", { categoryId: id });
      return res.status(404).json({
        success: false,
        message: "Danh mục không tồn tại",
      });
    }

    logger.info("Xóa danh mục thành công", {
      categoryId: id,
      categoryName: deletedCategory.name,
    });

    return res.status(200).json({
      success: true,
      message: "Xóa danh mục thành công",
    });
  } catch (error) {
    logger.error("Lỗi khi xóa danh mục", {
      categoryId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};
