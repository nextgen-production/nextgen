const { hash, compare } = require("bcryptjs");
const { createHmac } = require("crypto");
const logger = require("./logger");

/**
 * Hash một giá trị với bcrypt
 * @param {string} value - Giá trị cần hash
 * @param {number} saltRounds - Số vòng salt (mặc định: 12)
 * @returns {Promise<string>} Giá trị đã hash
 */
exports.doHash = async (value, saltRounds = 12) => {
  try {
    logger.info("Bắt đầu hash giá trị", {
      saltRounds,
    });

    if (!value) {
      throw new Error("Giá trị hash không được để trống");
    }

    const hashedValue = await hash(value, saltRounds);

    logger.info("Hash giá trị thành công");
    return hashedValue;
  } catch (error) {
    logger.error("Lỗi khi hash giá trị", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Không thể hash giá trị");
  }
};

/**
 * So sánh giá trị với hash
 * @param {string} value - Giá trị cần so sánh
 * @param {string} hashedValue - Giá trị hash để so sánh
 * @returns {Promise<boolean>} Kết quả so sánh
 */
exports.compareHash = async (value, hashedValue) => {
  try {
    logger.info("Bắt đầu so sánh hash");

    if (!value || !hashedValue) {
      throw new Error("Thiếu giá trị để so sánh");
    }

    const isMatch = await compare(value, hashedValue);

    logger.info("So sánh hash thành công", {
      matched: isMatch,
    });
    return isMatch;
  } catch (error) {
    logger.error("Lỗi khi so sánh hash", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Không thể so sánh giá trị hash");
  }
};

/**
 * Tạo HMAC với SHA256
 * @param {string} value - Giá trị cần hash
 * @param {string} secret - Secret key
 * @returns {string} HMAC hex string
 */
exports.hmacProcess = (value, secret) => {
  try {
    logger.info("Bắt đầu tạo HMAC");

    if (!value || !secret) {
      throw new Error("Thiếu giá trị hoặc secret key");
    }

    const hmac = createHmac("sha256", secret).update(value).digest("hex");

    logger.info("Tạo HMAC thành công");
    return hmac;
  } catch (error) {
    logger.error("Lỗi khi tạo HMAC", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Không thể tạo HMAC");
  }
};

/**
 * Tạo random hash
 * @param {number} length - Độ dài hash mong muốn
 * @returns {string} Random hash
 */
exports.generateRandomHash = (length = 32) => {
  try {
    logger.info("Bắt đầu tạo random hash", {
      length,
    });

    const randomBytes = require("crypto").randomBytes(length);
    const randomHash = randomBytes.toString("hex");

    logger.info("Tạo random hash thành công");
    return randomHash;
  } catch (error) {
    logger.error("Lỗi khi tạo random hash", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Không thể tạo random hash");
  }
};
