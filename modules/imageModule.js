const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    imageUrl: { type: String },
  },
  { timestamps: true }
);

/**
 * Image Model
 *
 * - image: URL or path of the stored image
 * - timestamps: Automatically adds createdAt and updatedAt fields
 */

module.exports = mongoose.model("image", imageSchema);
