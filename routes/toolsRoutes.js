const express = require('express');
const toolsController = require('../controller/toolsController');
const { auth } = require('../middleware/authMiddleware'); // Assuming it's named authMiddleware.js

const router = express.Router();

// Add the new protected route
router.post(
    '/generate-preference-list',
    auth, // Use the correct auth middleware function
    toolsController.generatePreferenceList // Access the function within the imported object
);
module.exports = router;