// routes/branchRoutes.js
const express = require("express");
const router = express.Router();

// Import Controller functions for branch management
const {
    getBranch,
    updateBranch,
    deleteBranch
    // Note: createBranchForCourse is handled in courseRoutes.js
    // as it relates to adding a branch *to* a course.
} = require("../controller/branchController");

// Import Middleware for authentication and authorization
const { auth, isAdmin } = require("../middleware/authMiddleware");

// --- Routes for Managing Individual Branches ---

// GET /apiv1/branch/:branchId - Retrieve details of a specific branch
// This route might be public or require authentication depending on your needs.
// Assuming public access for now.
router.get("/:branchId", getBranch);

// PUT /apiv1/branch/:branchId - Update details of a specific branch
// Requires authentication and admin privileges.
router.put("/:branchId", auth, isAdmin, updateBranch);

// DELETE /apiv1/branch/:branchId - Delete a specific branch
// Requires authentication and admin privileges.
router.delete("/:branchId", auth, isAdmin, deleteBranch);

module.exports = router; // Export the router for use in the main app file
