// routes/examRoutes.js
const express = require("express");
const router = express.Router();

const { createExam, getExam, getAllExams } = require("../controller/examController");
const { auth, isAdmin } = require("../middleware/authMiddleware"); // Added auth

router.post("/", auth, isAdmin, createExam); // Protect creation
router.get("/:id", getExam);                 // Public? Or auth?
router.get("/", getAllExams);                // Public? Or auth?

module.exports = router;