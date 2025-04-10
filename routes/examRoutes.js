const express = require("express");
const router = express.Router();

const { createExam, getExam, getAllExams } = require("../controller/examController");

router.post("/", createExam);
router.get("/:id", getExam); // Get a single exam by ID
router.get("/", getAllExams); // Get all exams

module.exports = router;
