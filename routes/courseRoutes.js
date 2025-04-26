// routes/courseRoutes.js
const express = require("express");
const router = express.Router();

const {
    getCourse, updateCourse, deleteCourse
} = require("../controller/courseController");
const { createBranchForCourse } = require("../controller/branchController"); // Add branch TO a course
const { auth, isAdmin } = require("../middleware/authMiddleware");

// Manage individual courses
router.get("/:courseId", getCourse);
router.put("/:courseId", auth, isAdmin, updateCourse);
router.delete("/:courseId", auth, isAdmin, deleteCourse);

// Add nested resource TO a course
router.post("/:courseId/branch", auth, isAdmin, createBranchForCourse);

module.exports = router;