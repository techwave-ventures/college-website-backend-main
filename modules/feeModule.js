const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema({
  category: { type: String, required: true },
  amt: { type: Number, required: true },
});

/**
 * Fee Model
 *
 * - category: Category of the student (e.g., General, OBC, SC/ST)
 * - amt: Fee amount for the respective category
 */

module.exports = mongoose.model("fee", feeSchema);
