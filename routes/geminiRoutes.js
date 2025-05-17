// File: routes/geminiRoutes.js
const express = require("express");
const router = express.Router();
const geminiController = require("../controller/geminiController"); // Adjust path

// Route to get college details using Gemini
// Example path: /apiv1/gemini/college-info/:collegeName
router.get("/college-info/:collegeName", geminiController.getCollegeDetailsWithGemini);

module.exports = router;