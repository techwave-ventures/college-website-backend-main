// routes/imageRoutes.js
const express = require("express");
const router = express.Router();

const {uploadImage, getImage, getAllImages} = require("../controller/imageController");
const { auth, isAdmin } = require("../middleware/../middleware/authMiddleware"); // Added auth

// router.post("/", auth, isAdmin, uploadImage); // Protect upload
router.post("/", uploadImage);                 // Unprotected Image Upload Route
router.get("/:imageId", getImage);             // Public? Or auth?
router.get("/", getAllImages);                // Public? Or auth?

module.exports = router;