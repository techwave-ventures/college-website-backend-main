// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

// Define consistent cookie name
const COOKIE_NAME = 'authToken';
// Define consistent env variable name for secret
const JWT_SECRET = process.env.API_SECRET;

exports.auth = async (req, res, next) => {
    // console.log("[Auth Middleware] Checking for cookie:", COOKIE_NAME);

    try {
        // *** CHANGE: Prioritize HTTP-only cookie ***
        // Use req.signedCookies if you used signed: true when setting cookie and initializing cookieParser
        const token = req.cookies?.[COOKIE_NAME];
        // const token = req.signedCookies?.[COOKIE_NAME]; // If using signed cookies

        if (!token) {
            // console.warn(`[Auth Middleware] Cookie '${COOKIE_NAME}' missing.`);
            return res.status(401).json({ success: false, message: `Authentication required. Please log in.` });
        }

        // console.log(`[Auth Middleware] Found cookie '${COOKIE_NAME}'. Verifying...`);

        // Verify the token
        try {
            // Use the consistent secret name
            const decodedPayload = jwt.verify(token, JWT_SECRET);
            // console.log("[Auth Middleware] Token verified successfully. Payload:", decodedPayload);

            // *** Ensure payload contains necessary info (like 'id' and 'accountType') ***
            if (!decodedPayload.id || !decodedPayload.accountType) {
                //  console.error("[Auth Middleware] Error: Decoded token payload missing 'id' or 'accountType'.");
                 // Clear the invalid cookie
                 res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
                 return res.status(401).json({ success: false, message: "Token payload is invalid." });
            }

            // Attach the decoded payload to the request object
            req.user = decodedPayload; // Make payload available

            next(); // Proceed

        } catch (jwtError) {
            // console.error("[Auth Middleware] JWT Verification Error:", jwtError.message);
            // Clear the invalid/expired cookie
            res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
            return res.status(401).json({
                 success: false,
                 message: `Session expired or token invalid. Please log in again.`, // User-friendly message
                 error: jwtError.name === 'TokenExpiredError' ? 'token_expired' : 'token_invalid'
            });
        }

    } catch (error) {
        // console.error("[Auth Middleware] Unexpected Error:", error);
        return res.status(500).json({
            success: false,
            message: `Internal server error during authentication.`,
        });
    }
};

// --- Role Check Middleware (isStudent, isAdmin) ---
// These should work as before, provided the JWT payload generated during login includes 'accountType'
// and the 'auth' middleware successfully attaches req.user. Your existing code for these looks fine.

exports.isStudent = async (req, res, next) => {
    // ... (your existing code is likely fine here, ensure req.user.accountType exists)
     if (!req.user || req.user.accountType !== "Student") {
          return res.status(403).json({ success: false, message: "Access denied. Student role required." });
     }
     next();
};

exports.isAdmin = async (req, res, next) => {
    // ... (your existing code is likely fine here, ensure req.user.accountType exists)
     if (!req.user || req.user.accountType !== "Admin") {
          return res.status(403).json({ success: false, message: "Access denied. Admin role required." });
     }
     next();
};