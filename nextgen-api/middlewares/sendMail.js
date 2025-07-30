const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

// Khởi tạo transport
const transport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

// Verify transport connection
transport.verify((error, success) => {
  if (error) {
    logger.error("Lỗi kết nối email service", {
      error: error.message,
      stack: error.stack,
    });
  } else {
    logger.info("Email service sẵn sàng", {
      email: process.env.EMAIL,
      service: "gmail",
    });
  }
});

// Override sendMail function để thêm logging
const originalSendMail = transport.sendMail.bind(transport);
transport.sendMail = async (mailOptions) => {
  try {
    logger.info("Bắt đầu gửi email", {
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    const info = await originalSendMail(mailOptions);

    logger.info("Gửi email thành công", {
      to: mailOptions.to,
      subject: mailOptions.subject,
      messageId: info.messageId,
    });

    return info;
  } catch (error) {
    logger.error("Lỗi khi gửi email", {
      to: mailOptions.to,
      subject: mailOptions.subject,
      error: error.message,
      stack: error.stack,
    });
    throw error; // Re-throw để controller xử lý
  }
};

module.exports = transport;
