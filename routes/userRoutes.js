// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/authMiddleware"); // Ensure path is correct
const userController = require("../controller/userController"); // Ensure path is correct

// GET /api/v1/users/me - Get profile of the currently logged-in user
// Protected by 'auth' middleware which checks the cookie
router.get("/getUserProfile", auth, userController.getUserProfile);

// Add the new route - PROTECTED
router.get('/me/plan-status', auth, userController.getUserPlanDetails);

module.exports = router;