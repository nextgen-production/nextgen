const Product = require("../models/product.model");
const Technology = require("../models/technology.model");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

// Constants
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "products");
const DEFAULT_TECH_ICON = "⚙️";
const REQUIRED_FIELDS = [
  "name",
  "price",
  "shortDescription",
  "description",
  "installation",
];

/**
 * Helper function để xử lý upload files
 */
const handleFileUpload = (files, oldPaths = []) => {
  // Xóa files cũ nếu có
  oldPaths.forEach((oldPath) => {
    const fullPath = path.join(__dirname, "..", oldPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info("Đã xóa file cũ", { path: oldPath });
    }
  });

  // Return paths của files mới
  return files.map((file) => `/uploads/products/${file.filename}`);
};

/**
 * Helper function để xử lý technologies
 */
const processTechnologies = async (techArray) => {
  try {
    return await Promise.all(
      techArray.map(async (techName) => {
        let tech = await Technology.findOne({ name: techName });
        if (!tech) {
          tech = await Technology.create({
            name: techName,
            icon: DEFAULT_TECH_ICON,
          });
          logger.info("Đã tạo technology mới", { name: techName });
        }
        return tech._id;
      })
    );
  } catch (error) {
    logger.error("Lỗi khi xử lý technologies", {
      error: error.message,
      technologies: techArray,
    });
    throw error;
  }
};

/**
 * Tạo sản phẩm mới
 */
exports.createProduct = async (req, res) => {
  try {
    logger.info("Bắt đầu tạo sản phẩm mới", {
      name: req.body.name,
    });

    // Validate required fields
    const missingFields = REQUIRED_FIELDS.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      logger.warn("Thiếu thông tin bắt buộc", { missingFields });
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ thông tin bắt buộc",
        missingFields,
      });
    }

    // Validate files
    if (!req.files?.coverImage || !req.files?.images) {
      logger.warn("Thiếu file ảnh");
      return res.status(400).json({
        success: false,
        message: "Vui lòng tải lên ảnh bìa và ảnh chi tiết sản phẩm",
      });
    }

    const {
      name,
      price,
      shortDescription,
      description,
      installation,
      videoUrl,
      technologies,
      category,
      subCategory,
    } = req.body;

    // Process technologies
    const techIds = await processTechnologies(JSON.parse(technologies));

    // Create new product
    const newProduct = await Product.create({
      name,
      price: Number(price),
      shortDescription,
      description,
      installation,
      coverImage: handleFileUpload(req.files.coverImage)[0],
      images: handleFileUpload(req.files.images),
      videoUrl,
      technologies: techIds,
      category,
      subCategory,
    });

    await newProduct.populate("technologies", "name icon");

    logger.info("Tạo sản phẩm thành công", {
      productId: newProduct._id,
      name: newProduct.name,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo sản phẩm thành công",
      data: newProduct,
    });
  } catch (error) {
    // Cleanup uploaded files
    if (req.files) {
      const files = [
        ...(req.files.images || []),
        ...(req.files.coverImage || []),
      ];
      files.forEach((file) => fs.unlinkSync(file.path));
    }

    logger.error("Lỗi khi tạo sản phẩm", {
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
 * Lấy danh sách sản phẩm có filter và phân trang
 */
exports.getProducts = async (req, res) => {
  try {
    const { category, search, technology, sort = "-createdAt" } = req.query;
    logger.info("Bắt đầu lấy danh sách sản phẩm", {
      filters: { category, search, technology, sort },
    });

    // Build query
    const query = { isActive: true };
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
      ];
    }

    // Handle technology filter
    if (technology) {
      const tech = await Technology.findOne({
        name: { $regex: technology, $options: "i" },
      });
      if (tech) query.technologies = tech._id;
    }

    // Execute query
    const products = await Product.find(query)
      .populate("technologies", "name icon")
      .sort(sort);

    logger.info("Lấy danh sách sản phẩm thành công", {
      count: products.length,
      filters: { category, search, technology },
    });

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy danh sách sản phẩm", {
      error: error.message,
      stack: error.stack,
      query: req.query,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

/**
 * Lấy chi tiết một sản phẩm
 */
exports.getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Bắt đầu lấy thông tin sản phẩm", { productId: id });

    const product = await Product.findById(id).populate(
      "technologies",
      "name icon"
    );

    if (!product) {
      logger.warn("Không tìm thấy sản phẩm", { productId: id });
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại",
      });
    }

    await product.incrementViews();
    logger.info("Lấy thông tin sản phẩm thành công", {
      productId: id,
      name: product.name,
      views: product.views,
    });

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    logger.error("Lỗi khi lấy thông tin sản phẩm", {
      productId: req.params.id,
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
 * Cập nhật thông tin sản phẩm
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Bắt đầu cập nhật sản phẩm", {
      productId: id,
      updates: req.body,
    });

    const product = await Product.findById(id);
    if (!product) {
      logger.warn("Không tìm thấy sản phẩm", { productId: id });
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại",
      });
    }

    const {
      name,
      price,
      shortDescription,
      description,
      installation,
      videoUrl,
      technologies,
      category,
      subCategory,
    } = req.body;

    // Handle file uploads
    let coverImage = product.coverImage;
    let images = product.images;

    if (req.files) {
      if (req.files.coverImage) {
        coverImage = handleFileUpload(req.files.coverImage, [
          product.coverImage,
        ])[0];
      }
      if (req.files.images) {
        images = handleFileUpload(req.files.images, product.images);
      }
    }

    // Process technologies if provided
    let techIds = product.technologies;
    if (technologies) {
      techIds = await processTechnologies(JSON.parse(technologies));
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        price: price ? Number(price) : product.price,
        shortDescription,
        description,
        installation,
        coverImage,
        images,
        videoUrl,
        technologies: techIds,
        category,
        subCategory,
      },
      { new: true }
    ).populate("technologies", "name icon");

    logger.info("Cập nhật sản phẩm thành công", {
      productId: id,
      name: updatedProduct.name,
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật sản phẩm thành công",
      data: updatedProduct,
    });
  } catch (error) {
    // Cleanup any newly uploaded files
    if (req.files) {
      const files = [
        ...(req.files.images || []),
        ...(req.files.coverImage || []),
      ];
      files.forEach((file) => fs.unlinkSync(file.path));
    }

    logger.error("Lỗi khi cập nhật sản phẩm", {
      productId: req.params.id,
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
 * Xóa sản phẩm
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Bắt đầu xóa sản phẩm", { productId: id });

    const product = await Product.findById(id);
    if (!product) {
      logger.warn("Không tìm thấy sản phẩm", { productId: id });
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại",
      });
    }

    // Delete associated images
    const imagePaths = [product.coverImage, ...product.images];
    handleFileUpload([], imagePaths);

    await Product.findByIdAndDelete(id);

    logger.info("Xóa sản phẩm thành công", {
      productId: id,
      name: product.name,
    });

    return res.status(200).json({
      success: true,
      message: "Xóa sản phẩm thành công",
    });
  } catch (error) {
    logger.error("Lỗi khi xóa sản phẩm", {
      productId: req.params.id,
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
 * Thêm đánh giá cho sản phẩm
 */
exports.addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    logger.info("Bắt đầu thêm đánh giá", {
      productId: id,
      userId: req.user._id,
    });

    const product = await Product.findById(id);
    if (!product) {
      logger.warn("Không tìm thấy sản phẩm", { productId: id });
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại",
      });
    }

    const review = {
      name: req.user.fullname,
      rating: Number(rating),
      comment,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user._id}`,
    };

    product.reviews.push(review);
    await product.save();

    logger.info("Thêm đánh giá thành công", {
      productId: id,
      userId: req.user._id,
      rating,
    });

    return res.status(200).json({
      success: true,
      message: "Thêm đánh giá thành công",
      data: product,
    });
  } catch (error) {
    logger.error("Lỗi khi thêm đánh giá", {
      productId: req.params.id,
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
 * Tăng số lượt tải xuống
 */
exports.incrementDownloads = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info("Bắt đầu tăng lượt tải", { productId: id });

    const product = await Product.findById(id);
    if (!product) {
      logger.warn("Không tìm thấy sản phẩm", { productId: id });
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại",
      });
    }

    await product.incrementDownloads();

    logger.info("Tăng lượt tải thành công", {
      productId: id,
      downloads: product.downloads,
    });

    return res.status(200).json({
      success: true,
      message: "Tăng lượt tải thành công",
      downloads: product.downloads,
    });
  } catch (error) {
    logger.error("Lỗi khi tăng lượt tải", {
      productId: req.params.id,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};
