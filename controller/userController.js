// File: controller/userController.js (or your chosen controller path)

const User = require("../modules/userModule"); // Adjust path to your User model

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
            console.error("[getUserProfile] Error: User ID not found in req.user. Check auth middleware.");
            return res.status(400).json({
                success: false,
                message: "User identifier missing from authentication token.",
            });
        }

        // Fetch user details from the database, excluding the password
        const user = await User.findById(userId).select("-password");

        if (!user) {
            console.warn(`[getUserProfile] Warning: User with ID ${userId} not found in database.`);
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
        console.error("[getUserProfile] Server Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching user profile.",
        });
    }
};

// Add other user-related controller functions here if needed (e.g., updateProfile)
