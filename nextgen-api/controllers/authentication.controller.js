const transport = require("../middlewares/sendMail");

const {
  signupSchema,
  signinSchema,
  acceptCodeSchema,
} = require("../middlewares/validator");
const User = require("../models/user.model");
const Joi = require("joi");
const { doHash, compareHash, hmacProcess } = require("../utils/hashing");
const jwt = require("jsonwebtoken");
const { getVerificationEmailTemplate } = require("../utils/template");
const logger = require("../utils/logger");

const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000; // 10 phút
const JWT_EXPIRY = "8h";
const COOKIE_EXPIRY = 8 * 3600000; // 8 giờ

const createToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      isVerified: user.isVerified,
      isAdmin: user.isAdmin,
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

const setCookie = (res, token) => {
  return res.cookie("Authorization", `Bearer ${token}`, {
    expires: new Date(Date.now() + COOKIE_EXPIRY),
    httpOnly: process.env.NODE_ENV === "production",
    secure: process.env.NODE_ENV === "production",
  });
};

exports.signup = async (req, res) => {
  const { email, password, fullname } = req.body;

  try {
    logger.info("Bắt đầu xử lý đăng ký tài khoản", { email });

    // Validate input
    const { error } = signupSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn("Dữ liệu đăng ký không hợp lệ", {
        email,
        error: error.message,
      });
      return res.status(400).json({
        success: false,
        message: "Thông tin đăng ký không hợp lệ",
        errors: error.details.map((err) => err.message),
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn("Email đã tồn tại trong hệ thống", { email });
      return res.status(400).json({
        success: false,
        message: "Địa chỉ email đã được sử dụng",
      });
    }

    // Create new user
    const hashedPassword = await doHash(password, 12);
    const newUser = await User.create({
      email,
      password: hashedPassword,
      fullname,
    });

    logger.info("Đăng ký tài khoản thành công", {
      userId: newUser._id,
      email: newUser.email,
    });

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công",
      data: userResponse,
    });
  } catch (error) {
    logger.error("Lỗi server khi đăng ký tài khoản", {
      email,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

exports.signin = async (req, res) => {
  const { email, password } = req.body;

  try {
    logger.info("Bắt đầu xử lý đăng nhập", { email });

    // Validate input
    const { error } = signinSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn("Dữ liệu đăng nhập không hợp lệ", {
        email,
        error: error.message,
      });
      return res.status(400).json({
        success: false,
        message: "Thông tin đăng nhập không hợp lệ",
      });
    }

    // Check user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      logger.warn("Email không tồn tại", { email });
      return res.status(400).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
    }

    // Verify password
    const isValidPassword = await compareHash(password, user.password);
    if (!isValidPassword) {
      logger.warn("Mật khẩu không chính xác", { email });
      return res.status(400).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
    }

    // Generate token and set cookie
    const token = createToken(user);

    logger.info("Đăng nhập thành công", {
      userId: user._id,
      email: user.email,
      isAdmin: user.isAdmin,
    });

    return setCookie(res, token).json({
      success: true,
      message: "Đăng nhập thành công",
      token,
    });
  } catch (error) {
    logger.error("Lỗi server khi đăng nhập", {
      email,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

exports.signout = async (req, res) => {
  try {
    const user = req.user;
    logger.info("Xử lý đăng xuất", {
      userId: user?._id,
      email: user?.email,
    });

    res.clearCookie("Authorization").json({
      success: true,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    logger.error("Lỗi server khi đăng xuất", {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

exports.sendVerificationCode = async (req, res) => {
  const { email } = req.body;

  try {
    logger.info("Bắt đầu gửi mã xác thực", { email });

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn("Email không tồn tại", { email });
      return res.status(400).json({
        success: false,
        message: "Địa chỉ email không tồn tại",
      });
    }

    if (user.isVerified) {
      logger.warn("Tài khoản đã được xác thực", { email });
      return res.status(400).json({
        success: false,
        message: "Tài khoản đã được xác thực trước đó",
      });
    }

    // Generate and send verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const emailInfo = await transport.sendMail({
      from: process.env.EMAIL,
      to: user.email,
      subject: "Xác Minh Email Của Bạn - NextGen",
      html: getVerificationEmailTemplate(verificationCode),
    });

    if (emailInfo.accepted.includes(user.email)) {
      // Save hashed code
      const hashedCode = hmacProcess(
        verificationCode,
        process.env.HMAC_VERIFICATION_CODE_SECKET
      );

      user.verificationCode = hashedCode;
      user.verificationCodeValidation = Date.now();
      await user.save();

      logger.info("Gửi mã xác thực thành công", {
        email,
        messageId: emailInfo.messageId,
      });

      return res.status(200).json({
        success: true,
        message: "Mã xác thực đã được gửi đến email của bạn",
      });
    }

    logger.warn("Gửi mã xác thực thất bại", { email });
    return res.status(400).json({
      success: false,
      message: "Không thể gửi mã xác thực, vui lòng thử lại sau",
    });
  } catch (error) {
    logger.error("Lỗi server khi gửi mã xác thực", {
      email,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

exports.verifyVerificationCode = async (req, res) => {
  const { email, providedCode } = req.body;
  console.log(req.body);
  try {
    logger.info("Bắt đầu xác thực mã", { email });
    logger.info("Code", { providedCode });
    // Validate input
    const { error } = acceptCodeSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn("Dữ liệu không hợp lệ", {
        email,
        error: error.message,
      });
      return res.status(400).json({
        success: false,
        message: "Mã xác thực không hợp lệ",
      });
    }

    // Find user and check verification status
    const user = await User.findOne({ email }).select(
      "+verificationCode +verificationCodeValidation"
    );

    if (!user) {
      logger.warn("Email không tồn tại", { email });
      return res.status(400).json({
        success: false,
        message: "Địa chỉ email không tồn tại",
      });
    }

    if (user.isVerified) {
      logger.warn("Tài khoản đã được xác thực", { email });
      return res.status(400).json({
        success: false,
        message: "Tài khoản đã được xác thực trước đó",
      });
    }

    // Validate verification code exists
    if (!user.verificationCode || !user.verificationCodeValidation) {
      logger.warn("Chưa có mã xác thực", { email });
      return res.status(400).json({
        success: false,
        message: "Vui lòng yêu cầu gửi mã xác thực mới",
      });
    }

    // Check code expiration
    if (
      Date.now() - user.verificationCodeValidation >
      VERIFICATION_CODE_EXPIRY
    ) {
      logger.warn("Mã xác thực đã hết hạn", { email });
      return res.status(400).json({
        success: false,
        message: "Mã xác thực đã hết hạn, vui lòng yêu cầu mã mới",
      });
    }

    // Verify code
    const hashedProvidedCode = hmacProcess(
      providedCode.toString(),
      process.env.HMAC_VERIFICATION_CODE_SECKET
    );

    if (hashedProvidedCode === user.verificationCode) {
      user.isVerified = true;
      user.verificationCode = undefined;
      user.verificationCodeValidation = undefined;
      await user.save();

      logger.info("Xác thực tài khoản thành công", { email });

      return res.status(200).json({
        success: true,
        message: "Xác thực tài khoản thành công, vui lòng đăng nhập",
      });
    }

    logger.warn("Mã xác thực không chính xác", { email });
    return res.status(400).json({
      success: false,
      message: "Mã xác thực không chính xác",
    });
  } catch (error) {
    logger.error("Lỗi server khi xác thực mã", {
      email,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};
