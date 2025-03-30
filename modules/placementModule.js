const mongoose = require("mongoose");

const placementSchema = new mongoose.Schema(
  {
    average: { type: String },
    highest: { type: String },
  },
  { timestamps: true }
);

/**
 * Placement Model
 *
 * - average: Average placement package (e.g., "6 LPA")
 * - highest: Highest placement package (e.g., "45 LPA")
 * - timestamps: Automatically adds createdAt and updatedAt fields
 */

module.exports = mongoose.model("placement", placementSchema);
