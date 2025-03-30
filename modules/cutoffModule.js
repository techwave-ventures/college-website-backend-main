const mongoose = require("mongoose");

const cutoffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: mongoose.Schema.Types.ObjectId, ref: "image" },
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
