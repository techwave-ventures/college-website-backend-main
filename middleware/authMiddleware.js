// File: middleware/authMiddleware.js (adjust path as needed)

const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
// const User = require("../modules/userModule"); // User model not strictly needed for basic auth check

dotenv.config(); // Ensure environment variables are loaded

exports.auth = async (req, res, next) => {
    console.log("[Auth Middleware] Checking authentication..."); // Log entry

    try {
        let token = null;

        // 1. Try getting token from HTTP-only cookie (most secure)
        if (req.cookies?.auth_token) { // Use the name set by your /api/auth/set-token route
            token = req.cookies.auth_token;
            console.log("[Auth Middleware] Token found in cookie 'auth_token'.");
        }
        // 2. Fallback: Try getting token from Authorization header
        else if (req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.replace("Bearer ", "");
            console.log("[Auth Middleware] Token found in Authorization header.");
        }
        // 3. Fallback: Try getting token from request body (less common for GET requests)
        else if (req.body?.token) {
            token = req.body.token;
            console.log("[Auth Middleware] Token found in request body.");
        }

        // Check if token was found
        if (!token) {
            console.warn("[Auth Middleware] Token Missing.");
            return res.status(401).json({ success: false, message: `Token Missing` });
        }

        // Verify the token
        try {
            console.log("[Auth Middleware] Verifying token...");
            const decodedPayload = jwt.verify(token, process.env.API_SECRET);
            console.log("[Auth Middleware] Token verified successfully. Payload:", decodedPayload);

            // Attach the decoded payload to the request object
            // Ensure payload contains necessary info like 'id'
            if (!decodedPayload.id) {
                 console.error("[Auth Middleware] Error: Decoded token payload missing 'id'.");
                 return res.status(401).json({ success: false, message: "Token payload is invalid (missing ID)." });
            }
            req.user = decodedPayload; // Make payload available to subsequent middleware/controllers

            next(); // Proceed to the next step (e.g., the controller)

        } catch (jwtError) {
            // Handle JWT verification errors (invalid signature, expired, etc.)
            console.error("[Auth Middleware] JWT Verification Error:", jwtError.message);
            return res
                .status(401)
                .json({ success: false, message: `Token is invalid or expired: ${jwtError.message}` });
        }

    } catch (error) {
        // Catch unexpected errors during the token extraction or other steps
        console.error("[Auth Middleware] Unexpected Error:", error); // Log the actual error
        return res.status(500).json({ // Use 500 for unexpected server errors
            success: false,
            // Provide a more generic message for unexpected errors
            message: `Authentication error. Please try again later.`,
        });
    }
};

// --- Role Check Middleware (Keep as they were, but ensure req.user exists) ---

exports.isStudent = async (req, res, next) => {
    try {
        // Check if req.user was attached by the auth middleware
        if (!req.user || !req.user.accountType) {
             console.error("[isStudent Middleware] Error: req.user not populated correctly by auth middleware.");
             return res.status(403).json({ success: false, message: "User authentication data missing." });
        }

        // Check the account type from the token payload
        if (req.user.accountType !== "Student") {
            return res.status(403).json({ // 403 Forbidden is more appropriate here
                success: false,
                message: "Access denied. This route is protected for Students.",
            });
        }
        next(); // User is a Student, proceed
    } catch (error) {
        console.error("[isStudent Middleware] Error:", error);
        return res
            .status(500)
            .json({ success: false, message: `Server error during role verification.` });
    }
};

exports.isAdmin = async (req, res, next) => {
    try {
         // Check if req.user was attached by the auth middleware
        if (!req.user || !req.user.accountType) {
             console.error("[isAdmin Middleware] Error: req.user not populated correctly by auth middleware.");
             return res.status(403).json({ success: false, message: "User authentication data missing." });
        }

        // Check the account type from the token payload
        if (req.user.accountType !== "Admin") {
            return res.status(403).json({ // 403 Forbidden
                success: false,
                message: "Access denied. This route is protected for Admins.",
            });
        }
        next(); // User is an Admin, proceed
    } catch (error) {
        console.error("[isAdmin Middleware] Error:", error);
        return res
            .status(500)
            .json({ success: false, message: `Server error during role verification.` });
    }
};
