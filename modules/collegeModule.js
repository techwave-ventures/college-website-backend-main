const mongoose = require("mongoose");

const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    avatarImage: { type: mongoose.Schema.Types.ObjectId, ref: "image" },
    images: [{ type: mongoose.Schema.Types.ObjectId, ref: "image" }],
    dteCode: { type: Number, unique: true },
    location: { type: String },
    year: { type: String },
    affiliation: { type: String },
    type: { type: String },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "course" }],
    admissionProcess: { type: String },
    infrastructure: [{ type: String }],
    placement: { type: mongoose.Schema.Types.ObjectId, ref: "placement" },
    review: { type: String },
  },
  { timestamps: true }
);

/**
 * College Model
 *
 * - name: College name (required)
 * - avatarImage: Reference to the main college image
 * - images: Array of references to additional college images
 * - dteCode: Unique DTE (Directorate of Technical Education) code
 * - location: Geographical location of the college
 * - year: Year of establishment
 * - affiliation: University or board affiliation
 * - type: Type of college (Government, Private, Autonomous, etc.)
 * - courses: References to the courses offered by the college
 * - admissionProcess: Information about the admission process
 * - infrastructure: List of facilities and infrastructure available
 * - placement: Reference to the placement details
 * - review: Placeholder for reviews (planned to be converted into an object)
 * - timestamps: Automatically adds createdAt and updatedAt fields
 */

module.exports = mongoose.model("college", collegeSchema);
