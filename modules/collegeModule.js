// modules/collegeModule.js
const mongoose = require("mongoose");
const slugify = require('slugify'); // npm install slugify

const collegeSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        slug: { type: String, required: true, unique: true, index: true },
        avatarImage: { type: mongoose.Schema.Types.ObjectId, ref: "image" },
        description: { type: String }, // Corrected typo from 'desription'
        images: [{ type: mongoose.Schema.Types.ObjectId, ref: "image" }],
        dteCode: { type: Number, unique: true, required: true }, // Added required
        location: { type: String },
        year: { type: String },
        affiliation: { type: String },
        type: { type: String }, // e.g., Government, Private
        courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "course" }],
        admissionProcess: { type: String },
        infrastructure: [{ type: String }],
        placement: { type: mongoose.Schema.Types.ObjectId, ref: "placement" }, // College-level placement
        review: { type: String }, // Placeholder for potential future object
    },
    { timestamps: true }
);


// Pre-save hook to generate slug from name
collegeSchema.pre('save', function(next) {
    if (this.isModified('name') || this.isNew) {
        this.slug = slugify(this.name, { lower: true, strict: true });
    }
    next();
});



// --- NEW: Pre-findOneAndUpdate hook to update slug when name changes ---
collegeSchema.pre('findOneAndUpdate', async function(next) {
    // 'this' refers to the query object
    const update = this.getUpdate(); // Get the update operations

    // Check if the 'name' field is being modified in the update
    // Update can be complex ($set, $unset, etc.)
    // For simplicity, we check if 'name' is directly in $set or top-level
    let newName;
    if (update.$set && update.$set.name) {
        newName = update.$set.name;
    } else if (update.name) { // Handles cases where update is { name: 'New Name', ... } directly
        newName = update.name;
    }

    if (newName) {
        const newSlug = slugify(newName, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
        // Add the new slug to the update operations
        if (update.$set) {
            update.$set.slug = newSlug;
        } else {
            update.slug = newSlug; // If 'name' was top-level, 'slug' should be too
        }
        // If you are not using $set for all fields in your controller's findByIdAndUpdate,
        // you might need to explicitly add slug to this._update.$set
        // this.set({ slug: newSlug }); // Alternative way to set the field in the update
    }
    next();
});
// --- End Pre-findOneAndUpdate hook ---

/**
 * College Model
 *
 * - name: College name (required)
 * - avatarImage: Reference to the main college image
 * - description: Brief description of the college
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