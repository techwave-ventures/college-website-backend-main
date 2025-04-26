// modules/feeModule.js
const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema({
    category: { type: String, required: true }, // e.g., General, OBC, SC/ST
    amt: { type: Number, required: true }, // Fee amount
}, { timestamps: true }); // Added timestamps

/**
 * Fee Model
 *
 * - category: Category of the student (e.g., General, OBC, SC/ST)
 * - amt: Fee amount for the respective category
 */

module.exports = mongoose.model("fee", feeSchema);