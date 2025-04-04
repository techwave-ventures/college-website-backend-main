const express = require("express");
const router = express.Router();

const { createExam, getExam } = require("../controller/examController");

router.post("/", createExam);
router.get("/", getExam); // Add this line to fetch exams

module.exports = router;
