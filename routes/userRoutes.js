// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/authMiddleware"); // Ensure path is correct
const { getUserProfile } = require("../controller/userController"); // Ensure path is correct

// GET /api/v1/users/me - Get profile of the currently logged-in user
// Protected by 'auth' middleware which checks the cookie
router.get("/getUserProfile", auth, getUserProfile);

module.exports = router;