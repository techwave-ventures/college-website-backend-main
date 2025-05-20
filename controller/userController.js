// File: controller/userController.js (or your chosen controller path)

const User = require("../modules/userModule"); // Adjust path to your User model
const paymentController = require('../controller/paymentController'); // Import the controller functions
// const PLANS = require('../config/plans'); // Adjust path to your plans config
const { PLANS } = require('../config/plans'); // Adjust path to your plans config


/**
 * Get Logged-in User Profile
 * Fetches the profile details of the currently authenticated user.
 * Assumes the 'auth' middleware has run and attached user payload to req.user.
 */
exports.getUserProfile = async (req, res) => {
    try {
        // Get user ID from the decoded token payload attached by auth middleware
        const userId = req.user?.id; // Use optional chaining for safety

        if (!userId) {
            // console.error("[getUserProfile] Error: User ID not found in req.user. Check auth middleware.");
            return res.status(400).json({
                success: false,
                message: "User identifier missing from authentication token.",
            });
        }

        // Fetch user details from the database, excluding the password
        const user = await User.findById(userId).select("-password");

        if (!user) {
            // console.warn(`[getUserProfile] Warning: User with ID ${userId} not found in database.`);
            return res.status(404).json({
                success: false,
                message: "Authenticated user not found in database.",
            });
        }

        // Successfully found the user, return their profile data
        return res.status(200).json({
            success: true,
            user: user,
        });

    } catch (error) {
        // console.error("[getUserProfile] Server Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching user profile.",
        });
    }
};



/**
 * @route   GET /apiv1/users/me/plan-details (or /plan-status)
 * @desc    Get the authenticated user's profile, current plan, usage, and limits
 * @access  Protected (Requires authentication middleware)
 */
exports.getUserPlanDetails = async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }

    // console.log(`[getUserPlanDetails] Fetching plan details for user: ${userId}`);

    try {
        // 1. Fetch necessary user data - ADD name and email
        const user = await User.findById(userId)
            .select('name email counselingPlan paymentStatus collegeListGenerationsUsed planActivationDate') // Added name, email
            .lean(); // Use .lean() for faster, plain JS objects

        if (!user) {
            // console.error(`[getUserPlanDetails] User not found in DB: ${userId}`);
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const planId = user.counselingPlan;

        // 2. Look up plan limits from config
        let planDetailsFromConfig = null; // Renamed to avoid confusion with plan data from user
        let limit = 0;
        let planName = "No Plan";

        if (planId && PLANS[planId]) {
            planDetailsFromConfig = PLANS[planId];
            limit = planDetailsFromConfig.collegeListGeneratorLimit;
            planName = planDetailsFromConfig.name; // Use name from config for consistency
        } else {
            // console.warn(`[getUserPlanDetails] User ${userId} has invalid or null planId: ${planId}`);
            // If planId is null or invalid, check if it should default to 'free' details
            if (PLANS['free']) {
                 limit = PLANS['free'].collegeListGeneratorLimit;
                 planName = PLANS['free'].name;
            }
        }

        // 3. Construct the response - INCLUDE the user object
        const responsePayload = {
            success: true,
            // *** ADDED USER OBJECT TO RESPONSE ***
            user: {
                // Include only necessary, non-sensitive fields
                id: user._id, // Send ID if needed by frontend
                name: user.name,
                email: user.email,
                // DO NOT include password or other sensitive fields
            },
            // *************************************
            plan: {
                id: planId || 'free', // Default to free if null
                name: planName, // Use name derived from config or default
                status: user.paymentStatus,
                activationDate: user.planActivationDate,
            },
            usage: {
                collegeListGenerationsUsed: user.collegeListGenerationsUsed ?? 0, // Default to 0 if undefined
                collegeListGenerationLimit: user.collegeListGenerationLimit ?? 0,
            }
        };

        // console.log(`[getUserPlanDetails] Returning details for user ${userId}:`, JSON.stringify(responsePayload)); // Log the full payload
        return res.status(200).json(responsePayload);

    } catch (error) {
        // console.error(`[getUserPlanDetails] Error fetching plan details for user ${userId}:`, error);
        return res.status(500).json({ success: false, message: "Error fetching plan details." });
    }
};





// Add other user-related controller functions here if needed (e.g., updateProfile)
