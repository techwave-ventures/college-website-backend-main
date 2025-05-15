// routes/collegeRoutes.js
const express = require("express");
const router = express.Router();

const {
    createcollege, getcollege, getAllColleges, updatecollege, deleteCollege
} = require("../controller/collegeController");
const { createCourseForCollege } = require("../controller/courseController");
const { createPlacement } = require("../controller/placementController");
const { getCollegeBySlug } = require("../controller/collegeController");
const { auth, isAdmin } = require("../middleware/authMiddleware");

router.post("/", createcollege);
router.get("/", getAllColleges);
router.get("/:collegeId", getcollege);
router.get('/slug/:slug', getCollegeBySlug); //
router.put("/:collegeId", updatecollege);
router.delete("/:collegeId", auth, isAdmin, deleteCollege);

// Add nested resources TO a college
router.post("/:collegeId/placement", auth, isAdmin, createPlacement);
router.post("/:collegeId/course", auth, isAdmin, createCourseForCollege);

module.exports = router;