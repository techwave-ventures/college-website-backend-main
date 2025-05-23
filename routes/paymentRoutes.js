// File: routes/paymentRoutes.js

const express = require('express');
const paymentController = require('../controller/paymentController'); // Import the updated controller

// Import your authentication middleware
const { auth } = require('../middleware/authMiddleware'); // Adjust path if needed

const router = express.Router();

// --- Razorpay Order Initiation Route ---
// POST /apiv1/payments/initiate-plan
// Requires user authentication to know who is paying and potentially prefill data.
router.post(
    '/initiate-plan',
    auth, // Apply authentication middleware
    paymentController.initiateRazorpayOrder // Use the new Razorpay order function
);

// --- Razorpay Payment Verification Route ---
// POST /apiv1/payments/verify-razorpay
// Requires user authentication to link the payment to the logged-in user.
router.post(
    '/verify-razorpay',
    auth, // Apply authentication middleware
    paymentController.verifyRazorpayPayment // Use the new Razorpay verification function
);


// 
router.post(
    '/buy-limit',
    auth,
    paymentController.buyAdditionalLimit
);

// --- Razorpay Webhook Handler Route ---
// POST /apiv1/payments/razorpay-webhook
// This route MUST be public (no 'auth' middleware) as it's called by Razorpay servers.
// Security is handled by verifying the 'x-razorpay-signature' header.
router.post(
    '/razorpay-webhook',
    paymentController.handleRazorpayWebhook // Use the new Razorpay webhook handler
);




// --- Remove Old PhonePe Routes ---
// router.post('/callback', paymentController.handleCallback); // REMOVED
// router.get('/status/:merchantTransactionId', auth, paymentController.checkPaymentStatus); // REMOVED


module.exports = router; // Export the router
