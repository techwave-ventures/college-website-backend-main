// modules/imageModule.js
const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
    {
        imageUrl: { type: String, required: true }, // Make URL required
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