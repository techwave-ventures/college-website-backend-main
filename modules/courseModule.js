const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  duration: { type: String, required: true },
  branches: [{ type: mongoose.Schema.Types.ObjectId, ref: "branch" }],
  fees: [{ type: mongoose.Schema.Types.ObjectId, ref: "fee" }],
  placement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "placement",
  },
});

/**
 * Course Model
 *
 * - name: Name of the course (e.g., BE, BTECH)
 * - duration: Duration of the course (e.g., "4 years")
 * - branches: References to branch documents
 * - fees: References to fee documents
 * - placement: Contains avg (average package) and highest (highest package) ref to "placement" document
 */

module.exports = mongoose.model("course", courseSchema);
