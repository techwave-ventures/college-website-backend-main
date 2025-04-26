// modules/cutoffModule.js
const mongoose = require("mongoose");

const cutoffSchema = new mongoose.Schema(
    {
        name: { type: String, required: true }, // e.g., JEE Cutoff Round 1
        image: { type: mongoose.Schema.Types.ObjectId, ref: "image" }, // Ref to image containing cutoff data
    },
    { timestamps: true }
);

/**
 * Cutoff Model
 *
 * - name: Name of the cutoff exam/category (e.g., JEE Cutoff, NEET Cutoff)
 * - image: Reference to an image associated with the cutoff
 * - timestamps: Automatically adds createdAt and updatedAt fields
 */

module.exports = mongoose.model("cutoff", cutoffSchema);