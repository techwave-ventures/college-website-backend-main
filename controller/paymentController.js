// controllers/paymentController.js

const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid'); // Use uuid for robust unique IDs
require('dotenv').config();

// --- Import necessary configs and models ---
const { PLANS } = require('../config/plans'); // Adjust path as needed
const User = require('../modules/userModule'); // Adjust path as needed

// --- PhonePe Configuration (remains the same) ---
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1'; // Default to '1' if not set
const PHONEPE_ENV = process.env.PHONEPE_ENV || 'UAT'; // Default to UAT

const PHONEPE_HOST_URL = PHONEPE_ENV === 'PRODUCTION'
    ? 'https://api.phonepe.com/apis/hermes'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

const PHONEPE_PAY_API_URL = `${PHONEPE_HOST_URL}/pg/v1/pay`;

// Ensure URLs are defined in .env or provide fallbacks
const BACKEND_CALLBACK_URL = process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/apiv1/payment/callback` : 'http://localhost:5000/apiv1/payment/callback';
// Redirect URL now points to a generic status page
const FRONTEND_REDIRECT_URL = process.env.FRONTEND_REDIRECT_URL || 'http://localhost:5173/payment-status'; // General status page

// --- Controller Functions ---

/**
 * @route   POST /apiv1/payments/initiate-plan
 * @desc    Initiate payment for a specific plan for an authenticated user
 * @access  Protected (Requires authentication middleware)
 * @body    { "planId": "pro" } // Example
 */
exports.initiatePayment = async (req, res) => {
    // console.log("[initiatePayment] Request received for user:", req.user?.email); // req.user provided by auth middleware

    // 1. Get User ID and Input Validation
    const userId = req.user?.id;
    if (!userId) {
        // This should technically be caught by auth middleware, but double-check
        // console.error("[initiatePayment] Authentication Error: User ID not found in request.");
        return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const { planId } = req.body;
    if (!planId) {
        // console.error("[initiatePayment] Validation Failed: Missing planId in request body.");
        return res.status(400).json({ success: false, message: "Plan ID is required." });
    }

    // 2. Retrieve Plan Details from Backend Config
    const planDetails = PLANS[planId];
    if (!planDetails) {
        // console.error(`[initiatePayment] Validation Failed: Invalid planId received: ${planId}`);
        return res.status(400).json({ success: false, message: "Invalid plan selected." });
    }

    // Prevent initiating payment for the free plan
    if (planDetails.amount <= 0 || planId === 'starter') {
        //  console.warn(`[initiatePayment] Attempt to initiate payment for free/zero amount plan: ${planId} by user: ${userId}`);
         return res.status(400).json({ success: false, message: "Cannot initiate payment for a free plan." });
    }

    const paymentAmountPaisa = planDetails.amount; // Use amount from secure backend config
    const planName = planDetails.name; // Use name from secure backend config

    // console.log(`[initiatePayment] User ${userId} initiating payment for Plan: ${planName} (${planId}), Amount: ${paymentAmountPaisa} paisa`);

    // 3. Check PhonePe Credentials
    if (!PHONEPE_MERCHANT_ID || !PHONEPE_SALT_KEY || !PHONEPE_SALT_INDEX) {
        // console.error("[initiatePayment] Server Configuration Error: PhonePe credentials missing.");
        return res.status(500).json({ success: false, message: "Payment gateway configuration error." });
    }

    // 4. Generate Unique Merchant Transaction ID
    // Using UUID is generally more robust for uniqueness than timestamp combinations
    const merchantTransactionId = `TXN_${userId.slice(-6)}_${planId}_${uuidv4().split('-')[0]}`; // Example: TXN_abcdef_pro_f1a2b3c4
    const merchantUserId = userId; // Use the actual database user ID

    // console.log(`[initiatePayment] Generated Merchant Txn ID: ${merchantTransactionId}, Merchant User ID: ${merchantUserId}`);

    // --- CRITICAL STEP: Update User Record BEFORE Calling PhonePe ---
    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                counselingPlan: planId,        // Set the target plan
                paymentStatus: 'Pending',      // Mark payment as initiated
                paymentTransactionId: merchantTransactionId, // Link transaction to user
                // planActivationDate remains null until payment success
            },
            { new: true } // Return the updated document (optional)
        );

        if (!updatedUser) {
            // console.error(`[initiatePayment] Failed to find and update user ${userId} before PhonePe call.`);
            return res.status(404).json({ success: false, message: "User not found for updating plan status." });
        }
        // console.log(`[initiatePayment] User ${userId} DB updated: Plan set to ${planId}, Status to Pending, TxnID ${merchantTransactionId}`);

    } catch (dbError) {
        // console.error(`[initiatePayment] Database error updating user ${userId} before PhonePe call:`, dbError);
        return res.status(500).json({ success: false, message: "Failed to update user record before initiating payment." });
    }
    // --- End User Update ---


    // 5. Construct PhonePe Payload
    const paymentPayload = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: merchantUserId, // Use the database User ID
        amount: paymentAmountPaisa,     // Amount from PLANS config
        redirectUrl: `${FRONTEND_REDIRECT_URL}?merchantTransactionId=${merchantTransactionId}`, // Pass txnId back for status check
        redirectMode: "POST",           // Use POST for redirect as it's more reliable for passing data
        callbackUrl: BACKEND_CALLBACK_URL,
        mobileNumber: req.user.phoneNumber, // Use phone number from authenticated user record
        paymentInstrument: {
            type: "PAY_PAGE"
        }
        // You could add more user details here if needed by PhonePe (e.g., email)
        // email: req.user.email
    };

    // console.log("[initiatePayment] PhonePe Payload (Before Encoding):", JSON.stringify(paymentPayload, null, 2));

    // 6. Encode Payload and Calculate Checksum
    try {
        const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
        const stringToHash = base64Payload + "/pg/v1/pay" + PHONEPE_SALT_KEY;
        const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const xVerifyChecksum = sha256Hash + '###' + PHONEPE_SALT_INDEX;

        // console.log("[initiatePayment] Calculated X-VERIFY Checksum:", xVerifyChecksum);

        // 7. Make API Call to PhonePe
        const options = {
            method: 'POST',
            url: PHONEPE_PAY_API_URL,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': xVerifyChecksum
            },
            data: {
                request: base64Payload
            }
        };
        // console.log("[initiatePayment] Sending request to PhonePe API:", PHONEPE_PAY_API_URL);
        const phonepeResponse = await axios.request(options);
        // console.log("[initiatePayment] PhonePe API Response Status:", phonepeResponse.status);

        // 8. Process PhonePe Response
        if (phonepeResponse.data?.success && phonepeResponse.data?.data?.instrumentResponse?.redirectInfo?.url) {
            const redirectUrl = phonepeResponse.data.data.instrumentResponse.redirectInfo.url;
            // console.log("[initiatePayment] Payment initiation successful. Redirecting user.");
            return res.status(200).json({ success: true, redirectUrl: redirectUrl });
        } else {
            // console.error("[initiatePayment] PhonePe API indicated failure:", phonepeResponse.data);
            const errorMessage = phonepeResponse.data?.message || "PhonePe initiation failed.";
            // NOTE: User status is already 'Pending'. Callback or a status check mechanism should handle this failure.
            // You *could* try to revert the user status here, but it adds complexity.
            return res.status(500).json({ success: false, message: errorMessage });
        }

    } catch (error) {
        // console.error("[initiatePayment] Error during PhonePe interaction or checksum generation:", error.response?.data || error.message);
        if (error.response) {
            console.error("Error Response Status:", error.response.status);
            console.error("Error Response Data:", error.response.data);
        }
        // NOTE: User status is already 'Pending'. Callback/status check needed.
        const errorMessage = error.response?.data?.message || "Could not initiate payment via PhonePe.";
        const statusCode = error.response?.status || 500;
        return res.status(statusCode).json({ success: false, message: errorMessage });
    }
};

// handleCallback function - UPDATED
exports.handleCallback = async (req, res) => {
    // console.log("[handleCallback] Received callback from PhonePe.");
    const xVerifyHeader = req.headers['x-verify'] || req.headers['X-VERIFY'];
    const base64Response = req.body?.response;

    if (!xVerifyHeader || !base64Response) {
        // console.error("[handleCallback] Invalid callback: Missing 'x-verify' header or 'response' body.");
        // Still respond 200 to PhonePe to prevent retries for clearly invalid requests
        return res.status(200).json({ code: "BAD_REQUEST", message: "Invalid callback data received." });
    }

    // console.log("[handleCallback] Received X-VERIFY Header:", xVerifyHeader);

    try {
        // 1. Verify Checksum
        const saltKey = PHONEPE_SALT_KEY;
        const saltIndex = PHONEPE_SALT_INDEX;
        const stringToHash = base64Response + saltKey;
        const calculatedSha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const calculatedChecksum = calculatedSha256 + '###' + saltIndex;

        // console.log("[handleCallback] Calculated Checksum:", calculatedChecksum);

        if (xVerifyHeader !== calculatedChecksum) {
            // console.error("[handleCallback] Checksum mismatch! Request might be tampered.");
            // Respond 200 but indicate failure internally
            return res.status(200).json({ code: "CHECKSUM_FAILED", message: "Checksum verification failed." });
        }
        // console.log("[handleCallback] Checksum verified successfully.");

        // 2. Decode Response
        const decodedResponse = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf-8'));
        // console.log("[handleCallback] Decoded Response:", JSON.stringify(decodedResponse, null, 2));

        const merchantTransactionId = decodedResponse?.data?.merchantTransactionId;
        const paymentState = decodedResponse?.code; // e.g., 'PAYMENT_SUCCESS', 'PAYMENT_ERROR'
        const phonePeTransactionId = decodedResponse?.data?.transactionId;
        const amount = decodedResponse?.data?.amount; // Amount in paisa

        if (!merchantTransactionId || !paymentState) {
            // console.error("[handleCallback] Invalid decoded response: Missing merchantTransactionId or state code.");
            return res.status(200).json({ code: "INVALID_RESPONSE", message: "Invalid response data content." });
        }

        // console.log(`[handleCallback] Status for ${merchantTransactionId}: ${paymentState}, Amount: ${amount}, PhonePe Txn: ${phonePeTransactionId}`);

        // 3. Find User by Merchant Transaction ID
        const userToUpdate = await User.findOne({ paymentTransactionId: merchantTransactionId });

        if (!userToUpdate) {
            // console.error(`[handleCallback] User not found for merchantTransactionId: ${merchantTransactionId}. Cannot update status.`);
            return res.status(200).json({ code: "USER_NOT_FOUND", message: "Callback received, but user not found for this transaction." });
        }

        // 4. Verify Amount
        const expectedPlanId = userToUpdate.counselingPlan;
        const expectedPlanDetails = PLANS[expectedPlanId];
        if (!expectedPlanDetails || expectedPlanDetails.amount !== amount) {
            //  console.error(`[handleCallback] AMOUNT MISMATCH for ${merchantTransactionId}. User Plan: ${expectedPlanId}, Expected Amount: ${expectedPlanDetails?.amount}, Received Amount: ${amount}`);
             // Update status to Failed due to mismatch
             userToUpdate.paymentStatus = 'Failed';
             // Optionally add a note: userToUpdate.paymentNotes = `Amount mismatch: Expected ${expectedPlanDetails?.amount}, received ${amount}`;
             await userToUpdate.save();
             return res.status(200).json({ code: "AMOUNT_MISMATCH", message: "Callback received, but amount mismatch detected." });
        }

        // 5. Update User Record Based on Payment State

        // Prepare updates object
        const updates = {
            paymentStatus: userToUpdate.paymentStatus, // Default to current status
            planActivationDate: userToUpdate.planActivationDate,
            // Reset usage counter ONLY if payment is successful
            collegeListGenerationsUsed: userToUpdate.collegeListGenerationsUsed
        };

        if (paymentState === 'PAYMENT_SUCCESS') {
            // Only update if not already completed to prevent accidental counter resets
            if (updates.paymentStatus !== 'Completed') {
                updates.paymentStatus = 'Completed';
                updates.planActivationDate = new Date(); // Set activation date
                updates.collegeListGenerationsUsed = 0; // <<<--- RESET COUNTER HERE
                // console.log(`[handleCallback] Payment SUCCESS for ${merchantTransactionId}. Updating user ${userToUpdate.id} status to Completed and resetting usage counter.`);
            } else {
                //  console.log(`[handleCallback] Payment SUCCESS for ${merchantTransactionId} already processed for user ${userToUpdate.id}. No update needed.`);
            }
        } else if (['PAYMENT_ERROR', 'TRANSACTION_NOT_FOUND', 'TIMED_OUT', 'PAYMENT_DECLINED'].includes(paymentState)) { // Add more failure codes if needed
            // Only update if not already failed
             if (updates.paymentStatus !== 'Failed') {
                updates.paymentStatus = 'Failed';
                // updates.planActivationDate = null; // Clear activation date on failure
                // --- Optional: Reset plan on failure? ---
                // updates.counselingPlan = 'starter'; // Or null, depending on desired logic
                // updates.paymentTransactionId = null; // Clear the link to this failed transaction? Maybe not ideal.
                // console.log(`[handleCallback] Payment FAILED/ERROR for ${merchantTransactionId} (Code: ${paymentState}). Updating user ${userToUpdate.id} status to Failed.`);
             } else {
                //  console.log(`[handleCallback] Payment FAILED/ERROR for ${merchantTransactionId} already processed for user ${userToUpdate.id}. No status change.`);
             }
        } else if (paymentState === 'PAYMENT_PENDING') {
            // Keep status as Pending if it wasn't already Completed/Failed
            if (!['Completed', 'Failed'].includes(updates.paymentStatus)) {
                 updates.paymentStatus = 'Pending';
                //  console.log(`[handleCallback] Payment PENDING for ${merchantTransactionId}. User status remains Pending.`);
            }
        } else {
            // console.warn(`[handleCallback] Unhandled payment state code: ${paymentState} for ${merchantTransactionId}. User status not changed.`);
        }

        // Apply the updates to the user document
        Object.assign(userToUpdate, updates);
        await userToUpdate.save();
        // console.log(`[handleCallback] User ${userToUpdate.id} record updated based on callback.`);

        // 6. Respond to PhonePe
        return res.status(200).json({ code: "CALLBACK_PROCESSED", message: "Callback processed successfully" });

    } catch (error) {
        // console.error("[handleCallback] Internal server error processing callback:", error);
        // Respond 200 to PhonePe even on internal error to prevent retries, but log it.
        return res.status(200).json({ code: "INTERNAL_SERVER_ERROR", message: 'Internal server error processing callback.' });
    }
};


// Optional: Add a status check endpoint
/**
 * @route   GET /apiv1/payments/status/:merchantTransactionId
 * @desc    Check the status of a payment transaction (client-side polling)
 * @access  Protected (Requires authentication middleware)
 * @params  merchantTransactionId from the URL
 */
 exports.checkPaymentStatus = async (req, res) => {
    const userId = req.user?.id;
    const { merchantTransactionId } = req.params;

    if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }
    if (!merchantTransactionId) {
        return res.status(400).json({ success: false, message: "Merchant transaction ID is required." });
    }

    try {
        // Find the user AND verify the transaction belongs to them
        const user = await User.findOne({ _id: userId, paymentTransactionId: merchantTransactionId });

        if (!user) {
            // console.warn(`[checkPaymentStatus] User ${userId} tried to check status for unknown or mismatched Txn ID: ${merchantTransactionId}`);
            // Check if the Txn ID exists at all, maybe it belongs to another user? Or typo?
            const txnExists = await User.exists({ paymentTransactionId: merchantTransactionId });
            if (!txnExists) {
                 return res.status(404).json({ success: false, message: "Transaction not found." });
            } else {
                 return res.status(403).json({ success: false, message: "Access denied to this transaction status." });
            }
        }

        // Return the relevant status information
        // console.log(`[checkPaymentStatus] User ${userId} checked status for Txn ID ${merchantTransactionId}: ${user.paymentStatus}`);
        res.status(200).json({
            success: true,
            merchantTransactionId: user.paymentTransactionId,
            planId: user.counselingPlan,
            paymentStatus: user.paymentStatus, // 'Pending', 'Completed', 'Failed'
            planActivationDate: user.planActivationDate
        });

    } catch (error) {
        // console.error(`[checkPaymentStatus] Error fetching status for Txn ID ${merchantTransactionId} by user ${userId}:`, error);
        res.status(500).json({ success: false, message: "Error checking payment status." });
    }
};






// // controllers/paymentController.js

// const axios = require('axios');
// const crypto = require('crypto');
// const { v4: uuidv4 } = require('uuid'); // Use uuid for robust unique IDs
// require('dotenv').config();

// // --- Import necessary configs and models ---
// const { PLANS } = require('../config/plans'); // Adjust path as needed
// const User = require('../modules/userModule'); // Adjust path as needed

// // --- PhonePe Configuration (remains the same, but calls are skipped below) ---
// const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
// const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
// const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
// const PHONEPE_ENV = process.env.PHONEPE_ENV || 'UAT';

// const PHONEPE_HOST_URL = PHONEPE_ENV === 'PRODUCTION'
//     ? 'https://api.phonepe.com/apis/hermes'
//     : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

// const PHONEPE_PAY_API_URL = `${PHONEPE_HOST_URL}/pg/v1/pay`;

// // URLs (Callback URL might not be hit in this simulated flow)
// const BACKEND_CALLBACK_URL = process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/apiv1/payment/callback` : 'http://localhost:5000/apiv1/payment/callback';
// const FRONTEND_REDIRECT_URL = process.env.FRONTEND_REDIRECT_URL || 'http://localhost:5173/payment-status';

// // --- Controller Functions ---

// /**
//  * @route   POST /apiv1/payments/initiate-plan
//  * @desc    Initiate payment for a specific plan for an authenticated user
//  * *** MODIFIED FOR DEBUGGING: Skips actual PhonePe call and simulates success ***
//  * @access  Protected (Requires authentication middleware)
//  * @body    { "planId": "pro" } // Example
//  */
// exports.initiatePayment = async (req, res) => {
//     // Log the start of the request and the authenticated user's email
//     console.log("[initiatePayment DEBUG MODE] Request received for user:", req.user?.email);

//     // --- 1. Get User ID and Input Validation ---
//     // Extract user ID attached by the authentication middleware
//     const userId = req.user?.id;
//     // If userId is missing (shouldn't happen if auth middleware is correct), return 401 Unauthorized
//     if (!userId) {
//         console.error("[initiatePayment DEBUG MODE] Authentication Error: User ID not found in request.");
//         return res.status(401).json({ success: false, message: "Authentication required." });
//     }

//     // Extract the desired planId from the request body
//     const { planId } = req.body;
//     // If planId is missing, return 400 Bad Request
//     if (!planId) {
//         console.error("[initiatePayment DEBUG MODE] Validation Failed: Missing planId in request body.");
//         return res.status(400).json({ success: false, message: "Plan ID is required." });
//     }
//     console.log(`[initiatePayment DEBUG MODE] Received planId: ${planId}`);

//     // --- 2. Retrieve Plan Details from Backend Config ---
//     // Look up the plan details using the planId from the imported PLANS configuration
//     const planDetails = PLANS[planId];
//     // If planId doesn't correspond to a valid plan in the config, return 400 Bad Request
//     if (!planDetails) {
//         console.error(`[initiatePayment DEBUG MODE] Validation Failed: Invalid planId received: ${planId}`);
//         return res.status(400).json({ success: false, message: "Invalid plan selected." });
//     }

//     // Prevent initiating payment simulation for the free 'starter' plan or any plan with amount <= 0
//     if (planDetails.amount <= 0 || planId === 'starter') {
//          console.warn(`[initiatePayment DEBUG MODE] Attempt to initiate payment for free/zero amount plan: ${planId} by user: ${userId}. Aborting.`);
//          return res.status(400).json({ success: false, message: "Cannot initiate payment simulation for a free plan." });
//     }

//     // Get the amount (in paisa) and plan name securely from the backend config
//     const paymentAmountPaisa = planDetails.amount;
//     const planName = planDetails.name;

//     console.log(`[initiatePayment DEBUG MODE] User ${userId} initiating payment for Plan: ${planName} (${planId}), Amount: ${paymentAmountPaisa} paisa`);

//     // --- 3. Check PhonePe Credentials (Still good practice, though API call is skipped) ---
//     // Check if essential PhonePe config variables are present in the environment
//     if (!PHONEPE_MERCHANT_ID || !PHONEPE_SALT_KEY || !PHONEPE_SALT_INDEX) {
//         console.error("[initiatePayment DEBUG MODE] Server Configuration Error: PhonePe credentials missing in .env.");
//         // Return 500 Internal Server Error as it's a server config issue
//         return res.status(500).json({ success: false, message: "Payment gateway configuration error." });
//     }

//     // --- 4. Generate Unique Merchant Transaction ID ---
//     // Create a unique ID for this transaction attempt, incorporating user and plan info for easier tracking
//     const merchantTransactionId = `DEBUG_TXN_${userId.slice(-6)}_${planId}_${uuidv4().split('-')[0]}`;
//     // Use the actual database user ID as the merchantUserId
//     const merchantUserId = userId;

//     console.log(`[initiatePayment DEBUG MODE] Generated Merchant Txn ID: ${merchantTransactionId}, Merchant User ID: ${merchantUserId}`);

//     // --- 5. Update User Record (Mark as Pending Initially) ---
//     // This step is crucial to link the transaction ID to the user *before* any external interaction
//     let userBeforeUpdate; // To store user state before update for comparison/logging
//     try {
//         // Find the user first to log their state before update (optional but good for debug)
//         userBeforeUpdate = await User.findById(userId).select('counselingPlan paymentStatus').lean();
//         console.log(`[initiatePayment DEBUG MODE] User ${userId} state BEFORE update: Plan=${userBeforeUpdate?.counselingPlan}, Status=${userBeforeUpdate?.paymentStatus}`);

//         // Atomically find the user by ID and update their record
//         const updatedUser = await User.findByIdAndUpdate(
//             userId,
//             {
//                 // Set the plan the user is trying to purchase
//                 counselingPlan: planId,
//                 // Mark the payment status as 'Pending' while initiating
//                 paymentStatus: 'Pending',
//                 // Store the unique transaction ID we generated
//                 paymentTransactionId: merchantTransactionId,
//                 // Clear activation date and usage count (will be set on simulated success)
//                 planActivationDate: null,
//                 collegeListGenerationsUsed: 0, // Reset usage immediately when pending new plan
//             },
//             { new: true } // Option to return the modified document after update
//         );

//         // If findByIdAndUpdate returns null, the user wasn't found
//         if (!updatedUser) {
//             console.error(`[initiatePayment DEBUG MODE] Failed to find and update user ${userId}.`);
//             return res.status(404).json({ success: false, message: "User not found for updating plan status." });
//         }
//         // Log successful initial update
//         console.log(`[initiatePayment DEBUG MODE] User ${userId} DB updated successfully: Plan set to ${planId}, Status to Pending, TxnID ${merchantTransactionId}`);

//     } catch (dbError) {
//         // Catch any errors during the database operation
//         console.error(`[initiatePayment DEBUG MODE] Database error updating user ${userId} to Pending:`, dbError);
//         return res.status(500).json({ success: false, message: "Failed to update user record before initiating payment." });
//     }
//     // --- End Initial User Update ---


//     // --- 6. Simulate Payment Success (Instead of Calling PhonePe) ---
//     console.log("[initiatePayment DEBUG MODE] Skipping PhonePe API call and simulating successful payment.");
//     try {
//         // Update the user record again to mark the payment as completed
//         const finalUpdatedUser = await User.findByIdAndUpdate(
//             userId,
//             {
//                 // Set payment status to 'Completed'
//                 paymentStatus: 'Completed',
//                 // Set the activation date to the current time
//                 planActivationDate: new Date(),
//                 // Ensure usage counter is reset (might be redundant if reset above, but safe to include)
//                 collegeListGenerationsUsed: 0,
//                 // Keep the same counselingPlan and paymentTransactionId
//             },
//             { new: true } // Return the final updated document
//         );

//         // If the update fails (user somehow deleted between updates?), log error
//         if (!finalUpdatedUser) {
//              console.error(`[initiatePayment DEBUG MODE] Failed to find and update user ${userId} for simulated success.`);
//              // Note: Status is likely 'Pending' from previous step. Callback/manual check might be needed if this happens.
//              return res.status(404).json({ success: false, message: "User not found for final status update." });
//         }

//         // Log the successful simulation
//         console.log(`[initiatePayment DEBUG MODE] User ${userId} DB updated successfully for SIMULATED payment success: Status=Completed, Plan=${finalUpdatedUser.counselingPlan}, Activated=${finalUpdatedUser.planActivationDate}`);

//         // --- 7. Return Simulated Success Response to Frontend ---
//         // Send a 200 OK response indicating success, but provide a message about the simulation
//         // DO NOT send a redirectUrl
//         return res.status(200).json({
//             success: true,
//             message: `DEBUG MODE: Payment for plan '${planName}' simulated successfully. Plan activated.`,
//             // Include some user/plan details if helpful for frontend confirmation
//             user: { // Send back relevant user details (ensure password is not included)
//                 id: finalUpdatedUser._id,
//                 email: finalUpdatedUser.email,
//                 name: finalUpdatedUser.name,
//                 counselingPlan: finalUpdatedUser.counselingPlan,
//                 paymentStatus: finalUpdatedUser.paymentStatus,
//                 planActivationDate: finalUpdatedUser.planActivationDate,
//             },
//             merchantTransactionId: merchantTransactionId, // Send the generated Txn ID
//             // NO redirectUrl
//         });

//     } catch (dbError) {
//         // Catch errors during the second database update (simulated success)
//         console.error(`[initiatePayment DEBUG MODE] Database error updating user ${userId} for simulated success:`, dbError);
//         // Note: User status is likely 'Pending'. Callback/manual check might be needed.
//         return res.status(500).json({ success: false, message: "Failed to update user record for simulated payment success." });
//     }


//     /* --- 8. PHONEPE INTERACTION (COMMENTED OUT FOR DEBUGGING) ---

//     // 8.1. Construct PhonePe Payload
//     const paymentPayload = {
//         merchantId: PHONEPE_MERCHANT_ID,
//         merchantTransactionId: merchantTransactionId,
//         merchantUserId: merchantUserId,
//         amount: paymentAmountPaisa,
//         redirectUrl: `${FRONTEND_REDIRECT_URL}?merchantTransactionId=${merchantTransactionId}`,
//         redirectMode: "POST",
//         callbackUrl: BACKEND_CALLBACK_URL,
//         mobileNumber: req.user.phoneNumber,
//         paymentInstrument: {
//             type: "PAY_PAGE"
//         }
//     };
//     console.log("[initiatePayment] PhonePe Payload (Before Encoding):", JSON.stringify(paymentPayload, null, 2));

//     // 8.2. Encode Payload and Calculate Checksum
//     try {
//         const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
//         const stringToHash = base64Payload + "/pg/v1/pay" + PHONEPE_SALT_KEY;
//         const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
//         const xVerifyChecksum = sha256Hash + '###' + PHONEPE_SALT_INDEX;
//         console.log("[initiatePayment] Calculated X-VERIFY Checksum:", xVerifyChecksum);

//         // 8.3. Make API Call to PhonePe
//         const options = {
//             method: 'POST',
//             url: PHONEPE_PAY_API_URL,
//             headers: {
//                 accept: 'application/json',
//                 'Content-Type': 'application/json',
//                 'X-VERIFY': xVerifyChecksum
//             },
//             data: {
//                 request: base64Payload
//             }
//         };
//         console.log("[initiatePayment] Sending request to PhonePe API:", PHONEPE_PAY_API_URL);
//         const phonepeResponse = await axios.request(options);
//         console.log("[initiatePayment] PhonePe API Response Status:", phonepeResponse.status);

//         // 8.4. Process PhonePe Response
//         if (phonepeResponse.data?.success && phonepeResponse.data?.data?.instrumentResponse?.redirectInfo?.url) {
//             const redirectUrl = phonepeResponse.data.data.instrumentResponse.redirectInfo.url;
//             console.log("[initiatePayment] Payment initiation successful. Redirecting user.");
//             return res.status(200).json({ success: true, redirectUrl: redirectUrl });
//         } else {
//             console.error("[initiatePayment] PhonePe API indicated failure:", phonepeResponse.data);
//             const errorMessage = phonepeResponse.data?.message || "PhonePe initiation failed.";
//             return res.status(500).json({ success: false, message: errorMessage });
//         }

//     } catch (error) {
//         console.error("[initiatePayment] Error during PhonePe interaction or checksum generation:", error.response?.data || error.message);
//         if (error.response) {
//             console.error("Error Response Status:", error.response.status);
//             console.error("Error Response Data:", error.response.data);
//         }
//         const errorMessage = error.response?.data?.message || "Could not initiate payment via PhonePe.";
//         const statusCode = error.response?.status || 500;
//         return res.status(statusCode).json({ success: false, message: errorMessage });
//     }
//     */ // --- END OF COMMENTED OUT PHONEPE INTERACTION ---
// };

// // --- handleCallback function ---
// // This function might not be called in the simulated flow, but keep it for real payments
// exports.handleCallback = async (req, res) => {
//     console.log("[handleCallback] Received callback from PhonePe.");
//     const xVerifyHeader = req.headers['x-verify'] || req.headers['X-VERIFY'];
//     const base64Response = req.body?.response;

//     if (!xVerifyHeader || !base64Response) {
//         console.error("[handleCallback] Invalid callback: Missing 'x-verify' header or 'response' body.");
//         return res.status(200).json({ code: "BAD_REQUEST", message: "Invalid callback data received." });
//     }
//     console.log("[handleCallback] Received X-VERIFY Header:", xVerifyHeader);

//     try {
//         // 1. Verify Checksum
//         const saltKey = PHONEPE_SALT_KEY;
//         const saltIndex = PHONEPE_SALT_INDEX;
//         // Ensure salt key and index are defined
//         if (!saltKey || !saltIndex) {
//              console.error("[handleCallback] Server Configuration Error: PhonePe Salt Key/Index missing.");
//              return res.status(200).json({ code: "CONFIG_ERROR", message: "Server configuration error." });
//         }
//         const stringToHash = base64Response + saltKey;
//         const calculatedSha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
//         const calculatedChecksum = calculatedSha256 + '###' + saltIndex;
//         console.log("[handleCallback] Calculated Checksum:", calculatedChecksum);

//         if (xVerifyHeader !== calculatedChecksum) {
//             console.error("[handleCallback] Checksum mismatch! Request might be tampered.");
//             return res.status(200).json({ code: "CHECKSUM_FAILED", message: "Checksum verification failed." });
//         }
//         console.log("[handleCallback] Checksum verified successfully.");

//         // 2. Decode Response
//         const decodedResponse = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf-8'));
//         console.log("[handleCallback] Decoded Response:", JSON.stringify(decodedResponse, null, 2));

//         const merchantTransactionId = decodedResponse?.data?.merchantTransactionId;
//         const paymentState = decodedResponse?.code;
//         const phonePeTransactionId = decodedResponse?.data?.transactionId;
//         const amount = decodedResponse?.data?.amount;

//         if (!merchantTransactionId || !paymentState) {
//             console.error("[handleCallback] Invalid decoded response: Missing merchantTransactionId or state code.");
//             return res.status(200).json({ code: "INVALID_RESPONSE", message: "Invalid response data content." });
//         }
//         console.log(`[handleCallback] Status for ${merchantTransactionId}: ${paymentState}, Amount: ${amount}, PhonePe Txn: ${phonePeTransactionId}`);

//         // 3. Find User by Merchant Transaction ID
//         const userToUpdate = await User.findOne({ paymentTransactionId: merchantTransactionId });
//         if (!userToUpdate) {
//             console.error(`[handleCallback] User not found for merchantTransactionId: ${merchantTransactionId}. Cannot update status.`);
//             return res.status(200).json({ code: "USER_NOT_FOUND", message: "Callback received, but user not found for this transaction." });
//         }

//         // 4. Verify Amount
//         const expectedPlanId = userToUpdate.counselingPlan;
//         const expectedPlanDetails = PLANS[expectedPlanId];
//         if (!expectedPlanDetails || expectedPlanDetails.amount !== amount) {
//              console.error(`[handleCallback] AMOUNT MISMATCH for ${merchantTransactionId}. User Plan: ${expectedPlanId}, Expected Amount: ${expectedPlanDetails?.amount}, Received Amount: ${amount}`);
//              userToUpdate.paymentStatus = 'Failed';
//              // userToUpdate.paymentNotes = `Amount mismatch: Expected ${expectedPlanDetails?.amount}, received ${amount}`;
//              await userToUpdate.save();
//              return res.status(200).json({ code: "AMOUNT_MISMATCH", message: "Callback received, but amount mismatch detected." });
//         }

//         // 5. Update User Record Based on Payment State
//         const updates = {
//             paymentStatus: userToUpdate.paymentStatus,
//             planActivationDate: userToUpdate.planActivationDate,
//             collegeListGenerationsUsed: userToUpdate.collegeListGenerationsUsed
//         };

//         if (paymentState === 'PAYMENT_SUCCESS') {
//             if (updates.paymentStatus !== 'Completed') {
//                 updates.paymentStatus = 'Completed';
//                 updates.planActivationDate = new Date();
//                 updates.collegeListGenerationsUsed = 0;
//                 console.log(`[handleCallback] Payment SUCCESS for ${merchantTransactionId}. Updating user ${userToUpdate.id} status to Completed and resetting usage counter.`);
//             } else {
//                  console.log(`[handleCallback] Payment SUCCESS for ${merchantTransactionId} already processed for user ${userToUpdate.id}. No update needed.`);
//             }
//         } else if (['PAYMENT_ERROR', 'TRANSACTION_NOT_FOUND', 'TIMED_OUT', 'PAYMENT_DECLINED'].includes(paymentState)) {
//              if (updates.paymentStatus !== 'Failed') {
//                 updates.paymentStatus = 'Failed';
//                 console.log(`[handleCallback] Payment FAILED/ERROR for ${merchantTransactionId} (Code: ${paymentState}). Updating user ${userToUpdate.id} status to Failed.`);
//              } else {
//                  console.log(`[handleCallback] Payment FAILED/ERROR for ${merchantTransactionId} already processed for user ${userToUpdate.id}. No status change.`);
//              }
//         } else if (paymentState === 'PAYMENT_PENDING') {
//             if (!['Completed', 'Failed'].includes(updates.paymentStatus)) {
//                  updates.paymentStatus = 'Pending';
//                  console.log(`[handleCallback] Payment PENDING for ${merchantTransactionId}. User status remains Pending.`);
//             }
//         } else {
//             console.warn(`[handleCallback] Unhandled payment state code: ${paymentState} for ${merchantTransactionId}. User status not changed.`);
//         }

//         Object.assign(userToUpdate, updates);
//         await userToUpdate.save();
//         console.log(`[handleCallback] User ${userToUpdate.id} record updated based on callback.`);

//         // 6. Respond to PhonePe
//         return res.status(200).json({ code: "CALLBACK_PROCESSED", message: "Callback processed successfully" });

//     } catch (error) {
//         console.error("[handleCallback] Internal server error processing callback:", error);
//         return res.status(200).json({ code: "INTERNAL_SERVER_ERROR", message: 'Internal server error processing callback.' });
//     }
// };


// // --- checkPaymentStatus function ---
// // This function remains useful for checking the status after the simulated success or real callbacks
// exports.checkPaymentStatus = async (req, res) => {
//     const userId = req.user?.id;
//     const { merchantTransactionId } = req.params;

//     // Basic validation
//     if (!userId) {
//         return res.status(401).json({ success: false, message: "Authentication required." });
//     }
//     if (!merchantTransactionId) {
//         return res.status(400).json({ success: false, message: "Merchant transaction ID is required." });
//     }
//     console.log(`[checkPaymentStatus] Request for Txn ID: ${merchantTransactionId} by User: ${userId}`);

//     try {
//         // Find the user AND verify the transaction belongs to them
//         // Use the specific merchantTransactionId from the URL parameter
//         const user = await User.findOne({ _id: userId, paymentTransactionId: merchantTransactionId })
//                                .select('counselingPlan paymentStatus planActivationDate paymentTransactionId') // Select needed fields
//                                .lean(); // Use lean for read-only

//         if (!user) {
//             console.warn(`[checkPaymentStatus] User ${userId} tried to check status for unknown or mismatched Txn ID: ${merchantTransactionId}`);
//             // Check if the Txn ID exists at all, maybe it belongs to another user? Or typo?
//             const txnExists = await User.exists({ paymentTransactionId: merchantTransactionId });
//             if (!txnExists) {
//                  console.log(`[checkPaymentStatus] Transaction ${merchantTransactionId} not found anywhere.`);
//                  return res.status(404).json({ success: false, message: "Transaction not found." });
//             } else {
//                  console.log(`[checkPaymentStatus] Transaction ${merchantTransactionId} found but belongs to another user.`);
//                  return res.status(403).json({ success: false, message: "Access denied to this transaction status." });
//             }
//         }

//         // Return the relevant status information from the found user document
//         console.log(`[checkPaymentStatus] User ${userId} checked status for Txn ID ${merchantTransactionId}: Status=${user.paymentStatus}, Plan=${user.counselingPlan}`);
//         res.status(200).json({
//             success: true,
//             merchantTransactionId: user.paymentTransactionId, // Confirm the ID checked
//             planId: user.counselingPlan,
//             paymentStatus: user.paymentStatus, // 'Pending', 'Completed', 'Failed' from DB
//             planActivationDate: user.planActivationDate
//         });

//     } catch (error) {
//         console.error(`[checkPaymentStatus] Error fetching status for Txn ID ${merchantTransactionId} by user ${userId}:`, error);
//         res.status(500).json({ success: false, message: "Error checking payment status." });
//     }
// };