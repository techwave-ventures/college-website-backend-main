// routes/paymentRoutes.js
// Defines payment related API routes and applies middleware.

const express = require('express');
const paymentController = require('../controllers/paymentController'); // Import the controller functions

// Import your authentication middleware
// Make sure the path is correct and it exports an 'auth' function
const { auth } = require('../middleware/authMiddleware'); // Assuming it's named authMiddleware.js

const router = express.Router();

// --- Payment Initiation Route ---
// POST /apiv1/register-and-pay
// This route requires the user to be authenticated.
router.post(
    '/register-and-pay',
    auth, // Apply the authentication middleware first
    paymentController.initiatePayment // If auth passes, call the controller function
);


// --- PhonePe Callback Route ---
// POST /apiv1/payment/callback
// This route is called directly by PhonePe's servers.
// It should generally NOT have user authentication middleware (auth).
// PhonePe verifies the request using the X-VERIFY header checksum.
router.post(
    '/payment/callback',
    paymentController.handleCallback // Directly call the callback handler
);

module.exports = router; // Export the router
