// File: controller/paymentController.js

const Razorpay = require('razorpay'); // Import Razorpay SDK
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// --- Import necessary configs and models ---
const { PLANS } = require('../config/plans'); // Adjust path as needed
const User = require('../modules/userModule'); // Adjust path as needed

// --- Razorpay Configuration ---
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET; // For webhook verification

// --- Instantiate Razorpay Client ---
// Ensure keys are loaded before instantiation
let razorpayInstance;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
    });
    console.log("[Razorpay] Client instantiated successfully.");
} else {
    console.error("[Razorpay] FATAL ERROR: Razorpay Key ID or Key Secret is missing in environment variables. Payment initiation will fail.");
    // Optionally handle this more gracefully, maybe prevent server start
}


// --- Controller Functions ---

/**
 * @route   POST /apiv1/payments/initiate-plan
 * @desc    Create a Razorpay Order for a specific plan
 * @access  Protected
 * @body    { "planId": "pro", "userId": "...", "amount": ... } // Frontend sends planId, userId, amount
 */
exports.initiateRazorpayOrder = async (req, res) => {
    console.log("[initiateRazorpayOrder] Request received for user:", req.user?.email);

    // 1. Get User ID and Input Validation
    const userId = req.user?.id; // Provided by auth middleware
    if (!userId) {
        console.error("[initiateRazorpayOrder] Auth Error: User ID missing.");
        return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const { planId } = req.body; // Frontend should send the chosen plan ID
    if (!planId) {
        console.error("[initiateRazorpayOrder] Validation Failed: Missing planId.");
        return res.status(400).json({ success: false, message: "Plan ID is required." });
    }

    // 2. Retrieve Plan Details & Verify Amount
    const planDetails = PLANS[planId];
    if (!planDetails) {
        console.error(`[initiateRazorpayOrder] Validation Failed: Invalid planId: ${planId}`);
        return res.status(400).json({ success: false, message: "Invalid plan selected." });
    }
    if (planDetails.amount <= 0 || planId === 'starter') {
        console.warn(`[initiateRazorpayOrder] Attempt to initiate payment for free/zero amount plan: ${planId}`);
        return res.status(400).json({ success: false, message: "Cannot initiate payment for a free plan." });
    }

    const paymentAmountPaisa = planDetails.amount; // Amount from secure backend config
    const planName = planDetails.name;
    const currency = "INR"; // Assuming INR

    console.log(`[initiateRazorpayOrder] User ${userId} initiating order for Plan: ${planName} (${planId}), Amount: ${paymentAmountPaisa} paisa`);

    // 3. Check Razorpay Credentials (Instance Check)
    if (!razorpayInstance) {
        console.error("[initiateRazorpayOrder] Server Configuration Error: Razorpay client not instantiated.");
        return res.status(500).json({ success: false, message: "Payment gateway configuration error." });
    }

    // 4. Prepare Razorpay Order Options
    const receiptId = `receipt_${userId.slice(-6)}_${planId}_${Date.now()}`; // Unique receipt for your records
    const options = {
        amount: paymentAmountPaisa,
        currency: currency,
        receipt: receiptId,
        notes: {
            userId: userId,
            planId: planId,
            email: req.user.email, // Assuming email is in req.user
            name: req.user.name // Assuming name is in req.user
        }
    };

    // 5. Create Razorpay Order
    try {
        console.log("[initiateRazorpayOrder] Creating Razorpay order with options:", options);
        const order = await razorpayInstance.orders.create(options);
        console.log("[initiateRazorpayOrder] Razorpay Order Created:", order);

        if (!order || !order.id) {
            throw new Error("Failed to create Razorpay order or order ID missing.");
        }

        // --- Store Order ID and Mark Payment as Pending (Optional but Recommended) ---
        try {
            await User.findByIdAndUpdate(userId, {
                // Store razorpay_order_id if you added it to the schema
                // razorpay_order_id: order.id,
                paymentStatus: 'Pending', // Mark as pending
                paymentTransactionId: receiptId, // Use your receipt ID or order.id as reference
                counselingPlan: planId // Associate the plan being paid for
            });
            console.log(`[initiateRazorpayOrder] User ${userId} DB updated: Status Pending, OrderID ${order.id} linked (via receipt/notes).`);
        } catch (dbError) {
            console.error(`[initiateRazorpayOrder] DB Error updating user ${userId} after order creation:`, dbError);
            // Proceed with payment, but log the error. Handle potential inconsistencies later.
        }
        // --- End Store Order ID ---

        // 6. Respond to Frontend with Order Details
        res.status(200).json({
            success: true,
            key_id: RAZORPAY_KEY_ID, // Public Key ID
            amount: order.amount,
            currency: order.currency,
            order_id: order.id,
            planName: planName, // Send plan name for description
            // Prefill details (ensure these exist in req.user from auth middleware)
            prefill: {
                name: req.user.name || '',
                email: req.user.email || '',
                contact: req.user.phoneNumber || '' // Assuming phoneNumber is in req.user
            },
            notes: order.notes,
            theme: { color: '#4f46e5' } // Example Indigo theme color
        });

    } catch (error) {
        console.error("[initiateRazorpayOrder] Error creating Razorpay order:", error);
        const errorMessage = error.message || "Could not initiate payment via Razorpay.";
        res.status(500).json({ success: false, message: errorMessage });
    }
};


/**
 * @route   POST /apiv1/payments/verify-razorpay
 * @desc    Verify Razorpay payment signature after successful payment on frontend
 * @access  Protected
 * @body    { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
exports.verifyRazorpayPayment = async (req, res) => {
    console.log("[verifyRazorpayPayment] Request received for user:", req.user?.email);

    const userId = req.user?.id;
    if (!userId) {
        console.error("[verifyRazorpayPayment] Auth Error: User ID missing.");
        return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        console.error("[verifyRazorpayPayment] Validation Failed: Missing Razorpay payment details.");
        return res.status(400).json({ success: false, message: "Missing required payment verification details." });
    }

    // 1. Construct the string for signature verification
    const bodyString = razorpay_order_id + "|" + razorpay_payment_id;

    // 2. Generate the expected signature
    try {
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET) // Use your Key Secret
            .update(bodyString)
            .digest('hex');

        console.log(`[verifyRazorpayPayment] Received Signature: ${razorpay_signature}`);
        console.log(`[verifyRazorpayPayment] Expected Signature: ${expectedSignature}`);

        // 3. Compare Signatures
        if (expectedSignature === razorpay_signature) {
            console.log(`[verifyRazorpayPayment] Signature VALID for Order ID: ${razorpay_order_id}`);

            // --- Update User Record on Successful Verification ---
            try {
                // Find user associated with this order (e.g., via notes or stored order ID)
                // It's safer to find by ID and check if the order ID matches if stored
                const userToUpdate = await User.findById(userId);

                if (!userToUpdate) {
                     console.error(`[verifyRazorpayPayment] User ${userId} not found for verification.`);
                     // Respond success to client, but log error. Avoid double charging.
                     return res.status(404).json({ success: false, message: "User not found during verification." });
                }

                // Check if payment wasn't already marked completed (e.g., by webhook)
                if (userToUpdate.paymentStatus !== 'Completed') {
                    // Fetch plan details again to get the correct limit
                    const planId = userToUpdate.counselingPlan; // Get plan associated during initiation
                    const planDetails = PLANS[planId];
                    const limit = planDetails ? planDetails.collegeListGeneratorLimit : 0; // Default to 0 if plan somehow invalid

                    userToUpdate.paymentStatus = 'Completed';
                    userToUpdate.planActivationDate = new Date();
                    // Reset usage counter based on the plan purchased
                    userToUpdate.prefListGenerationsUsed = 0; // Reset usage
                    // Optionally store payment ID for reference
                    // userToUpdate.razorpay_payment_id = razorpay_payment_id;

                    await userToUpdate.save();
                    console.log(`[verifyRazorpayPayment] User ${userId} DB updated: Status Completed, Plan ${planId} activated, Usage reset.`);

                    return res.status(200).json({ success: true, message: "Payment verified successfully. Plan activated." });

                } else {
                    console.log(`[verifyRazorpayPayment] Payment for Order ID: ${razorpay_order_id} already marked as Completed for user ${userId}.`);
                     return res.status(200).json({ success: true, message: "Payment already verified." });
                }

            } catch (dbError) {
                console.error(`[verifyRazorpayPayment] DB Error updating user ${userId} after verification:`, dbError);
                // Payment is verified, but DB update failed. Critical error, needs manual check.
                // Respond success to client to avoid retry, but log severity.
                return res.status(500).json({ success: false, message: "Payment verified but failed to update user record. Contact support." });
            }
            // --- End User Update ---

        } else {
            console.warn(`[verifyRazorpayPayment] Signature INVALID for Order ID: ${razorpay_order_id}`);
            return res.status(400).json({ success: false, message: "Payment verification failed: Invalid signature." });
        }
    } catch (error) {
        console.error("[verifyRazorpayPayment] Error during signature verification:", error);
        return res.status(500).json({ success: false, message: "Internal server error during payment verification." });
    }
};


/**
 * @route   POST /apiv1/payments/razorpay-webhook
 * @desc    Handle incoming webhooks from Razorpay (e.g., payment.captured)
 * @access  Public (Verification via signature)
 */
exports.handleRazorpayWebhook = async (req, res) => {
    const secret = RAZORPAY_WEBHOOK_SECRET;
    const receivedSignature = req.headers['x-razorpay-signature'];
    const requestBody = JSON.stringify(req.body); // Use raw body if possible from framework/middleware

    console.log("[handleRazorpayWebhook] Received webhook.");
    // console.log("[handleRazorpayWebhook] Body:", requestBody);
    // console.log("[handleRazorpayWebhook] Signature:", receivedSignature);

    if (!secret) {
         console.error("[handleRazorpayWebhook] Webhook secret not configured on server.");
         return res.status(500).send('Webhook secret not configured.');
    }
    if (!receivedSignature) {
         console.warn("[handleRazorpayWebhook] Missing X-Razorpay-Signature header.");
         return res.status(400).send('Signature header missing.');
    }

    try {
        // 1. Verify Webhook Signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(requestBody)
            .digest('hex');

        if (expectedSignature === receivedSignature) {
            console.log("[handleRazorpayWebhook] Webhook signature VERIFIED.");
            const event = req.body.event;
            const payload = req.body.payload;

            // 2. Process Relevant Events (e.g., payment captured)
            if (event === 'payment.captured') {
                const paymentEntity = payload.payment.entity;
                const orderId = paymentEntity.order_id;
                const paymentId = paymentEntity.id;
                const amount = paymentEntity.amount; // Amount in paisa
                const status = paymentEntity.status; // Should be 'captured'
                const notes = paymentEntity.notes || {}; // Access notes if present
                const userIdFromNotes = notes.userId; // Get userId from notes stored during order creation

                console.log(`[handleRazorpayWebhook] Event: ${event}, OrderID: ${orderId}, PaymentID: ${paymentId}, Status: ${status}, Amount: ${amount}, UserID (from Notes): ${userIdFromNotes}`);

                if (status === 'captured' && userIdFromNotes) {
                    // --- Update User Record based on Webhook ---
                    // Find user by ID stored in notes
                    const userToUpdate = await User.findById(userIdFromNotes);
                    if (userToUpdate) {
                         // Verify amount against user's pending plan amount
                         const planId = userToUpdate.counselingPlan;
                         const expectedPlanDetails = PLANS[planId];

                         if (expectedPlanDetails && expectedPlanDetails.amount === amount) {
                            // Check if already completed (by verification route)
                            if (userToUpdate.paymentStatus !== 'Completed') {
                                userToUpdate.paymentStatus = 'Completed';
                                userToUpdate.planActivationDate = new Date();
                                userToUpdate.prefListGenerationsUsed = 0; // Reset usage
                                // userToUpdate.razorpay_payment_id = paymentId; // Store payment ID
                                await userToUpdate.save();
                                console.log(`[handleRazorpayWebhook] User ${userIdFromNotes} updated via webhook: Status Completed, Plan ${planId} activated, Usage reset.`);
                            } else {
                                console.log(`[handleRazorpayWebhook] Payment for Order ${orderId} already marked Completed for user ${userIdFromNotes}. Webhook redundant.`);
                            }
                         } else {
                             console.error(`[handleRazorpayWebhook] AMOUNT MISMATCH for Order ${orderId}. Expected: ${expectedPlanDetails?.amount}, Received: ${amount}. User status not updated.`);
                             // Potentially flag this transaction for review
                         }
                    } else {
                        console.error(`[handleRazorpayWebhook] User ${userIdFromNotes} (from notes) not found for Order ${orderId}.`);
                    }
                    // --- End User Update ---
                } else {
                     console.warn(`[handleRazorpayWebhook] Payment status is not 'captured' or userId missing in notes for Order ${orderId}. Status: ${status}`);
                }
            }
            // Add handlers for other events like 'payment.failed', 'refund.processed' if needed

            // Acknowledge receipt to Razorpay
            res.status(200).json({ status: 'ok' });

        } else {
            console.warn("[handleRazorpayWebhook] Webhook signature INVALID.");
            res.status(400).send('Invalid webhook signature.');
        }
    } catch (error) {
        console.error("[handleRazorpayWebhook] Error processing webhook:", error);
        res.status(500).send('Error processing webhook.'); // Send generic error
    }
};