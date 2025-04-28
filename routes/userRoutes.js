// File: routes/userRoutes.js (or your chosen routes path)

const express = require("express");
const router = express.Router();

// --- Import Middleware ---
// Adjust the path to your auth middleware file
const { auth } = require("../middleware/authMiddleware");

// --- Import Controllers ---
// Adjust the path to your user controller file
const { getUserProfile } = require("../controller/userController");

// --- Define User Routes ---

// GET /apiv1/users/me - Get profile of the currently logged-in user
// This route is protected by the 'auth' middleware.
router.get("/me", auth, getUserProfile);

// Add other user-related routes here if needed (e.g., PUT /me for updates)
// Example: router.put("/me", auth, updateProfileController);


module.exports = router; // Export the router