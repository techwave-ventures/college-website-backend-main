const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    bName: { type: String, required: true },
    cutOffs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "cutoff",
      },
    ],
  },
  { timestamps: true }
);

/**
 * Branch Model
 *
 * - bName: Name of the branch (e.g., Computer Science, Mechanical Engineering)
 * - cutOffs: Array of cutoff records (references CutoffSchema)
 * - timestamps: Automatically adds createdAt and updatedAt fields
 */

module.exports = mongoose.model("branch", branchSchema);
