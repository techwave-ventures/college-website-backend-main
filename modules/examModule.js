// modules/examModule.js
const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
    {
        name: { type: String, required: true }, // Made name required
        colleges: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "college",
            default: []
        }],
    },
    { timestamps: true }
);

/**
 * Exam Model
 *
 * - name: Name of the exam (e.g., JEE, NEET, GATE)
 * - colleges: References to colleges accepting this exam
 * - timestamps: Automatically adds createdAt and updatedAt fields
 */

module.exports = mongoose.model("exam", examSchema);