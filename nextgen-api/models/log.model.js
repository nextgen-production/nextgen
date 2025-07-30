const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ["error", "info", "warn"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      path: String,
      method: String,
      functionName: String,
      lineNumber: String,
      fileName: String,
      stack: String,
    },
    user: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
      email: String,
    },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = mongoose.model("loggers", logSchema);
