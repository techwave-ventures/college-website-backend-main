// controllers/paymentController.js
// Contains the logic for handling PhonePe payment initiation and callbacks.

const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// --- PhonePe Configuration ---
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
const PHONEPE_SALT_INDEX = process.env.PHONEPE_API_KEY_INDEX || '1'; // Default to 1 if not set
const PHONEPE_ENV = process.env.PHONEPE_ENV || 'UAT'; // 'UAT' or 'PRODUCTION'

const PHONEPE_HOST_URL = PHONEPE_ENV === 'PRODUCTION'
    ? 'https://api.phonepe.com/apis/hermes'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

const PHONEPE_PAY_API_URL = `${PHONEPE_HOST_URL}/pg/v1/pay`;

// Ensure URLs are defined in your .env
const BACKEND_CALLBACK_URL = process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/apiv1/payment/callback` : 'http://localhost:3001/apiv1/payment/callback'; // Provide a default for safety
const FRONTEND_REDIRECT_URL = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/payment-status` : 'http://localhost:3000/payment-status'; // Provide a default

// --- Controller Functions ---

/**
 * initiatePayment
 * Handles the request from the frontend to start the PhonePe payment process.
 * Expects registration data in req.body.
 * Expects authenticated user info in req.user (added by auth middleware).
 */
exports.initiatePayment = async (req, res) => {
    console.log("[initiatePayment] Request received for user:", req.user?.email); // Log authenticated user
    console.log("[initiatePayment] Request body:", req.body);

    // 1. Extract and Validate Form Data
    const {
        name,
        casteCategory,
        email, // Use email from authenticated user (req.user) for consistency? Or from form? Decide based on requirements.
        phoneNumber, // Use phone from authenticated user (req.user)? Or from form?
        whatsappNumber,
        questions
    } = req.body;

    // Use authenticated user's details if preferred, otherwise use form data
    const userEmail = req.user?.email || email;
    const userPhoneNumber = req.user?.phoneNumber || phoneNumber; // Assuming phoneNumber is in req.user payload

    // Basic validation
    if (!name || !casteCategory || !userEmail || !userPhoneNumber || !whatsappNumber || !questions) {
        console.error("[initiatePayment] Validation Failed: Missing required fields.");
        return res.status(400).json({ success: false, message: "Missing required registration fields." });
    }
     if (!/^\d{10}$/.test(userPhoneNumber)) {
         console.error("[initiatePayment] Validation Failed: Invalid phone number format.");
         return res.status(400).json({ success: false, message: "Invalid phone number format (must be 10 digits)." });
    }
     if (!/^\d{10}$/.test(whatsappNumber)) {
         console.error("[initiatePayment] Validation Failed: Invalid WhatsApp number format.");
         return res.status(400).json({ success: false, message: "Invalid WhatsApp number format (must be 10 digits)." });
    }

    // --- Payment Details ---
    const amount = 100; // Example: 1 Rupee (Amount in paisa)
    const merchantTransactionId = `MT_${uuidv4().replace(/-/g, '').slice(0, 25)}`; // Ensure unique and within length limits
    const merchantUserId = req.user?.id || `MUID_${userEmail.split('@')[0]}`; // Use authenticated user ID if available

    console.log(`[initiatePayment] Processing Transaction ID: ${merchantTransactionId} for User ID: ${merchantUserId}`);

    // 2. Construct PhonePe Payload
    const paymentPayload = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: merchantUserId,
        amount: amount,
        redirectUrl: FRONTEND_REDIRECT_URL, // User returns here after payment attempt
        redirectMode: "POST", // Recommended for better handling on frontend
        callbackUrl: BACKEND_CALLBACK_URL, // Server-to-server notification URL
        mobileNumber: userPhoneNumber, // Pass user's phone number
        paymentInstrument: {
            type: "PAY_PAGE"
        }
    };

    // 3. Encode Payload and Calculate Checksum
    try {
        const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
        const stringToHash = base64Payload + "/pg/v1/pay" + PHONEPE_SALT_KEY;
        const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const xVerifyChecksum = sha256Hash + '###' + PHONEPE_SALT_INDEX;

        console.log("[initiatePayment] Calculated X-VERIFY Checksum.");

        // 4. *** Optional: Save Initial Registration Data to Database ***
        // Store user details, merchantTransactionId, status ('INITIATED'), amount etc.
        // Link it to the authenticated user (req.user.id)
        console.log("[initiatePayment] Placeholder: Save initial registration data to DB here.");
        // Example: await db.Registrations.create({ userId: req.user.id, name, ...otherData, merchantTransactionId, status: 'INITIATED' });


        // 5. Make API Call to PhonePe
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

        console.log("[initiatePayment] Sending request to PhonePe API:", PHONEPE_PAY_API_URL);
        const phonepeResponse = await axios.request(options);
        console.log("[initiatePayment] PhonePe API Response Status:", phonepeResponse.status);

        // 6. Process PhonePe Response
        if (phonepeResponse.data?.success && phonepeResponse.data?.data?.instrumentResponse?.redirectInfo?.url) {
            const redirectUrl = phonepeResponse.data.data.instrumentResponse.redirectInfo.url;
            console.log("[initiatePayment] Payment initiation successful.");
            // Send the redirect URL back to the frontend
            return res.status(200).json({ success: true, redirectUrl: redirectUrl });
        } else {
            console.error("[initiatePayment] PhonePe API indicated failure:", phonepeResponse.data);
            const errorMessage = phonepeResponse.data?.message || "PhonePe initiation failed.";
            // *** Optional: Update DB status to FAILED ***
            return res.status(500).json({ success: false, message: errorMessage });
        }

    } catch (error) {
        console.error("[initiatePayment] Error during PhonePe interaction:", error.response?.data || error.message);
        // *** Optional: Update DB status to FAILED ***
        const errorMessage = error.response?.data?.message || "Could not initiate payment.";
        const statusCode = error.response?.status || 500;
        return res.status(statusCode).json({ success: false, message: errorMessage });
    }
};


/**
 * handleCallback
 * Handles the server-to-server callback from PhonePe after a payment attempt.
 * This route should NOT typically require user authentication.
 */
exports.handleCallback = async (req, res) => { // Made async for potential DB operations
    console.log("[handleCallback] Received callback from PhonePe.");

    // 1. Extract X-VERIFY header and base64 encoded response body
    // Header names can sometimes be lowercase, check carefully
    const xVerifyHeader = req.headers['x-verify'] || req.headers['X-VERIFY'];
    const base64Response = req.body?.response;

    if (!xVerifyHeader || !base64Response) {
        console.error("[handleCallback] Invalid callback: Missing 'x-verify' header or 'response' body.");
        return res.status(400).send('Invalid callback data received.'); // Respond clearly
    }

    console.log("[handleCallback] Received X-VERIFY Header:", xVerifyHeader);
    // console.log("[handleCallback] Received Base64 Body:", base64Response); // Avoid logging potentially large body unless debugging

    // 2. Verify the Checksum
    try {
        const saltKey = PHONEPE_SALT_KEY;
        const saltIndex = PHONEPE_SALT_INDEX;
        const stringToHash = base64Response + saltKey;
        const calculatedSha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const calculatedChecksum = calculatedSha256 + '###' + saltIndex;

        console.log("[handleCallback] Calculated Checksum:", calculatedChecksum);

        if (xVerifyHeader !== calculatedChecksum) {
            console.error("[handleCallback] Checksum mismatch! Request might be tampered.");
            // Respond but do not process
            return res.status(400).send('Checksum verification failed.');
        }

        console.log("[handleCallback] Checksum verified successfully.");

        // 3. Decode the Response
        const decodedResponse = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf-8'));
        // console.log("[handleCallback] Decoded Response:", decodedResponse); // Log if needed for debugging

        // 4. Process Payment Status
        const merchantTransactionId = decodedResponse?.data?.merchantTransactionId;
        const paymentState = decodedResponse?.code; // e.g., 'PAYMENT_SUCCESS', 'PAYMENT_ERROR'
        const phonePeTransactionId = decodedResponse?.data?.transactionId;
        const amount = decodedResponse?.data?.amount; // Amount in paisa

        if (!merchantTransactionId || !paymentState) {
             console.error("[handleCallback] Invalid decoded response: Missing transaction ID or state code.");
             return res.status(400).send('Invalid response data content.');
        }

        console.log(`[handleCallback] Status for ${merchantTransactionId}: ${paymentState}, Amount: ${amount}`);

        // 5. *** Update Your Database ***
        // Find the order/registration using merchantTransactionId.
        // IMPORTANT: Check if the transaction hasn't already been processed (idempotency).
        // IMPORTANT: Verify the 'amount' received matches the expected amount for the transaction.
        // Update status based on paymentState ('PAYMENT_SUCCESS', 'PAYMENT_FAILED', etc.)
        console.log(`[handleCallback] Placeholder: Find registration for ${merchantTransactionId} in DB.`);
        // Example:
        // const registration = await db.Registrations.findOne({ merchantTransactionId });
        // if (registration && registration.paymentStatus !== 'SUCCESS' && registration.amount * 100 === amount) {
        //     registration.paymentStatus = paymentState === 'PAYMENT_SUCCESS' ? 'SUCCESS' : 'FAILED';
        //     registration.phonePeTransactionId = phonePeTransactionId;
        //     registration.paymentResponse = decodedResponse; // Store full response if needed
        //     await registration.save();
        //     console.log(`[handleCallback] Database updated for ${merchantTransactionId} to ${registration.paymentStatus}`);
        // } else if (!registration) {
        //      console.error(`[handleCallback] Registration not found for ${merchantTransactionId}`);
        // } else if (registration.amount * 100 !== amount) {
        //      console.error(`[handleCallback] Amount mismatch for ${merchantTransactionId}. Expected ${registration.amount * 100}, got ${amount}`);
        // } else {
        //     console.log(`[handleCallback] Transaction ${merchantTransactionId} already processed.`);
        // }
        console.log(`[handleCallback] Placeholder: Update DB status for ${merchantTransactionId} to ${paymentState}`);


        // 6. Respond to PhonePe
        // Acknowledge receipt. PhonePe doesn't typically use the response body.
        return res.status(200).json({ message: "Callback received successfully" }); // Send JSON response

    } catch (error) {
        console.error("[handleCallback] Error processing callback:", error);
        // Respond with an error status to PhonePe
        return res.status(500).json({ message: 'Error processing callback' }); // Send JSON response
    }
};