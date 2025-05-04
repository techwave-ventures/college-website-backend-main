// controllers/paymentController.js
// Contains the logic for handling PhonePe payment initiation and callbacks.

const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// --- PhonePe Configuration ---
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const PHONEPE_ENV = process.env.PHONEPE_ENV || 'UAT';

const PHONEPE_HOST_URL = PHONEPE_ENV === 'PRODUCTION'
    ? 'https://api.phonepe.com/apis/hermes'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

const PHONEPE_PAY_API_URL = `${PHONEPE_HOST_URL}/pg/v1/pay`;

const BACKEND_CALLBACK_URL = process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/apiv1/payment/callback` : 'http://localhost:5000/apiv1/payment/callback'; // Adjusted default port
const FRONTEND_REDIRECT_URL = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/payment-status` : 'http://localhost:5173/payment-status';

// --- Controller Functions ---

exports.initiatePayment = async (req, res) => {
    console.log("[initiatePayment] Request received for user:", req.user?.email);
    console.log("[initiatePayment] Request body:", req.body);

    // 1. Extract and Validate Form Data
    const {
        name,
        casteCategory,
        email: formEmail, // Rename to avoid conflict with userEmail
        phoneNumber: formPhoneNumber, // Rename
        whatsappNumber,
        questions
    } = req.body;

    // Prioritize authenticated user details, fall back to form data
    const userEmail = req.user?.email || formEmail;
    // Ensure req.user.phoneNumber is available if using it, otherwise use formPhoneNumber
    const validatedPhoneNumber = req.user?.phoneNumber || formPhoneNumber;

    // Basic validation (ensure all fields used below are validated)
    if (!name || !casteCategory || !userEmail || !validatedPhoneNumber || !whatsappNumber || !questions) {
        console.error("[initiatePayment] Validation Failed: Missing required fields.", { name, casteCategory, userEmail, validatedPhoneNumber, whatsappNumber, questions });
        return res.status(400).json({ success: false, message: "Missing required registration fields." });
    }
     if (!/^\d{10}$/.test(validatedPhoneNumber)) {
         console.error(`[initiatePayment] Validation Failed: Invalid phone number format: ${validatedPhoneNumber}`);
         return res.status(400).json({ success: false, message: "Invalid phone number format (must be 10 digits)." });
    }
     if (!/^\d{10}$/.test(whatsappNumber)) {
         console.error(`[initiatePayment] Validation Failed: Invalid WhatsApp number format: ${whatsappNumber}`);
         return res.status(400).json({ success: false, message: "Invalid WhatsApp number format (must be 10 digits)." });
    }
     if (!PHONEPE_MERCHANT_ID || !PHONEPE_SALT_KEY || !PHONEPE_SALT_INDEX) {
         console.error("[initiatePayment] Server Configuration Error: PhonePe credentials missing in .env");
         return res.status(500).json({ success: false, message: "Payment gateway configuration error." });
     }


    // --- Payment Details ---
    const amount = 100; // Amount in paisa (₹1)
    // Ensure unique ID, maybe shorter for testing
    const merchantTransactionId = `CAMPUSSAATHI_${Date.now()}`; // Simpler unique ID
    const merchantUserId = req.user?.id || `MUID_${userEmail.replace(/[^a-zA-Z0-9]/g, '_').slice(0,20)}`; // Use authenticated user ID, ensure valid characters

    console.log(`[initiatePayment] Processing Txn ID: ${merchantTransactionId} for User ID: ${merchantUserId}, Amount: ${amount} paisa`);

    // 2. Construct PhonePe Payload
    const paymentPayload = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: merchantUserId,
        amount: amount,
        redirectUrl: FRONTEND_REDIRECT_URL,
        redirectMode: "POST",
        callbackUrl: BACKEND_CALLBACK_URL,
        mobileNumber: validatedPhoneNumber, // Use the validated phone number
        paymentInstrument: {
            type: "PAY_PAGE"
        }
        // Consider adding email if required by your specific PhonePe setup:
        // email: userEmail,
    };

    // *** ADD DETAILED LOGGING OF THE PAYLOAD ***
    console.log("[initiatePayment] PhonePe Payload (Before Encoding):", JSON.stringify(paymentPayload, null, 2));
    // *********************************************

    // 3. Encode Payload and Calculate Checksum
    try {
        const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
        const stringToHash = base64Payload + "/pg/v1/pay" + PHONEPE_SALT_KEY;
        const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const xVerifyChecksum = sha256Hash + '###' + PHONEPE_SALT_INDEX;

        // *** LOG CHECKSUM FOR DEBUGGING (Remove in production) ***
        console.log("[initiatePayment] Base64 Payload:", base64Payload);
        console.log("[initiatePayment] String to Hash:", stringToHash); // Check if salt key is appended correctly
        console.log("[initiatePayment] Calculated X-VERIFY Checksum:", xVerifyChecksum);
        // ********************************************************

        // 4. Optional: Save Initial Registration Data to Database (Placeholder)
        console.log("[initiatePayment] Placeholder: Save initial registration data to DB here.");

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
            return res.status(200).json({ success: true, redirectUrl: redirectUrl });
        } else {
            console.error("[initiatePayment] PhonePe API indicated failure:", phonepeResponse.data);
            const errorMessage = phonepeResponse.data?.message || "PhonePe initiation failed.";
            return res.status(500).json({ success: false, message: errorMessage });
        }

    } catch (error) {
        console.error("[initiatePayment] Error during PhonePe interaction:", error.response?.data || error.message);
        // Log the full error response if available
        if (error.response) {
             console.error("Error Response Status:", error.response.status);
             console.error("Error Response Headers:", error.response.headers);
             console.error("Error Response Data:", error.response.data);
        }
        const errorMessage = error.response?.data?.message || "Could not initiate payment.";
        const statusCode = error.response?.status || 500;
        return res.status(statusCode).json({ success: false, message: errorMessage });
    }
};

// handleCallback function remains the same as before
exports.handleCallback = async (req, res) => {
    // ... (Keep the existing callback logic) ...
    console.log("[handleCallback] Received callback from PhonePe.");
    const xVerifyHeader = req.headers['x-verify'] || req.headers['X-VERIFY'];
    const base64Response = req.body?.response;
    if (!xVerifyHeader || !base64Response) {
        console.error("[handleCallback] Invalid callback: Missing 'x-verify' header or 'response' body.");
        return res.status(400).send('Invalid callback data received.');
    }
    console.log("[handleCallback] Received X-VERIFY Header:", xVerifyHeader);
    try {
        const saltKey = PHONEPE_SALT_KEY;
        const saltIndex = PHONEPE_SALT_INDEX;
        const stringToHash = base64Response + saltKey;
        const calculatedSha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const calculatedChecksum = calculatedSha256 + '###' + saltIndex;
        console.log("[handleCallback] Calculated Checksum:", calculatedChecksum);
        if (xVerifyHeader !== calculatedChecksum) {
            console.error("[handleCallback] Checksum mismatch! Request might be tampered.");
            return res.status(400).send('Checksum verification failed.');
        }
        console.log("[handleCallback] Checksum verified successfully.");
        const decodedResponse = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf-8'));
        const merchantTransactionId = decodedResponse?.data?.merchantTransactionId;
        const paymentState = decodedResponse?.code;
        const phonePeTransactionId = decodedResponse?.data?.transactionId;
        const amount = decodedResponse?.data?.amount;
        if (!merchantTransactionId || !paymentState) {
             console.error("[handleCallback] Invalid decoded response: Missing transaction ID or state code.");
             return res.status(400).send('Invalid response data content.');
        }
        console.log(`[handleCallback] Status for ${merchantTransactionId}: ${paymentState}, Amount: ${amount}`);
        console.log(`[handleCallback] Placeholder: Update DB for ${merchantTransactionId} with status ${paymentState}`);
        return res.status(200).json({ message: "Callback received successfully" });
    } catch (error) {
        console.error("[handleCallback] Error processing callback:", error);
        return res.status(500).json({ message: 'Error processing callback' });
    }
};
