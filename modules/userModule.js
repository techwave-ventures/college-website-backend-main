const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
      name: { type: String, required: true },
      email: { type: String, required: true, trim: true, unique: true }, // Added unique constraint
      phoneNumber: { type: String },
      password: { type: String, required: true },
      accountType: {
          type: String,
          enum: ["Student", "Admin"], // Added "Admin"
          required: true
      },
  },
  { timestamps: true }
);

/**
 * User Model
 *
 * - name: Full name of the user (required)
 * - email: Email address of the user (required, trimmed)
 * - phoneNumber: Contact number of the user (optional)
 * - password: Hashed password of the user (required)
 * - accountType: Defines user role, currently supports "Student" only (required)
 * - timestamps: Automatically adds createdAt and updatedAt fields
 */

module.exports = mongoose.model("user", userSchema);
 