// routes/authRoutes.js
const express = require("express");
const router = express.Router();

// Import controllers
const {
    login,
    signup,
    logout,             // <-- Import logout
    checkAuthStatus     // <-- Import checkAuthStatus
} = require("../controller/authController"); // Adjust path

// Import auth middleware (only needed for routes that require the user to be logged *in*)
const { auth } = require("../middleware/authMiddleware"); // Adjust path

// --- Public Routes ---
router.post("/login", login);
router.post("/signup", signup);

// --- Protected Routes ---
router.post("/logout", logout); // Logout doesn't strictly need auth, but POST is good practice

// Route to check current user's auth status based on cookie
// Use the 'auth' middleware to verify the cookie first
router.get("/me", auth, checkAuthStatus);

module.exports = router;