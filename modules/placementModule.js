// modules/placementModule.js
const mongoose = require("mongoose");

const placementSchema = new mongoose.Schema(
    {
        averageSalary: { type: Number },
        highestSalary: { type: Number },
    },
    { timestamps: true }
);

/**
 * Placement Model
 *
 * - averageSalary: Average placement package (e.g., "6 LPA")
 * - highestSalary: Highest placement package (e.g., "45 LPA")
 * - timestamps: Automatically adds createdAt and updatedAt fields
 */

module.exports = mongoose.model("placement", placementSchema);