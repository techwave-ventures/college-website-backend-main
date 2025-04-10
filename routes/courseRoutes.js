const express = require("express");
const router = express.Router();

const { createCourses } = require("../controller/courseController");

router.post("/", createCourses);

module.exports = router;
