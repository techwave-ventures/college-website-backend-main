const mongoose = require("mongoose");
const { PLANS } = require('../config/plans'); // Adjust path if your PLANS config is elsewhere

// Extract the plan IDs from the PLANS config to use in the enum dynamically
// Also include null for users who haven't been assigned a plan yet (or if assignment is post-signup)
const validPlanIds = [...Object.keys(PLANS), null];

const userSchema = new mongoose.Schema(
  {
    // --- Existing Fields ---
    name: { type: String, required: true },
    email: { type: String, required: true, trim: true, unique: true },
    phoneNumber: { type: String, required: true, trim: true, unique: true },
    password: { type: String, required: true },
    accountType: {
      type: String,
      enum: ["Student", "Admin"],
      required: true,
      default: "Student",
    },

    // --- New Fields for Plans & Usage ---

    /**
     * Stores the key/ID of the subscribed plan (e.g., 'starter', 'pro', 'accelerator').
     * Links to the PLANS configuration object for details like limits and features.
     */
    counselingPlan: {
      type: String,
      enum: validPlanIds, // Use actual plan IDs from your config + null
      default: 'free', // Default new users to the 'free' plan
    },

    /**
     * Optional: Track when the current plan became active (e.g., payment completion date).
     */
    planActivationDate: {
      type: Date,
    },

    /**
     * Tracks the payment status specifically for the *acquisition* of the current `counselingPlan`.
     * 'Completed' means the current plan is paid for (if it's not free).
     * 'Pending' could be used during the checkout process.
     * 'Failed' if the payment attempt failed.
     * `null` if no payment attempt was associated (e.g., free plan).
     */
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', null],
      default: null,
    },

    /**
     * Stores a reference ID from the payment gateway (e.g., Stripe Charge ID, Razorpay Payment ID)
     * for the transaction that activated the current `counselingPlan`. Useful for reconciliation.
     */
    paymentTransactionId: {
      type: String,
      trim: true,
      index: true, // Index for potentially looking up users by transaction ID (e.g., in webhooks)
      sparse: true // Allows null/missing values in the index, efficient if many users don't have this yet
    },

    /**
     * Counter for the number of times the user has used the College List Generator feature.
     * The *limit* for this usage is determined by checking the user's `counselingPlan`
     * against the `PLANS` configuration object, not stored directly here.
     */
    collegeListGenerationsUsed: { // Renamed for clarity based on PLANS config
      type: Number,
      default: 0,
      required: true, // Ensures the field always exists for incrementing
    },

    collegeListGenerationLimit: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not an integer value'
        }
    },
    // --- End New Fields ---
  },
  { timestamps: true } // Keeps createdAt and updatedAt
);

/**
 * User Model
 *
 * - name: Full name of the user (required)
 * - email: Email address of the user (required, trimmed, unique)
 * - phoneNumber: Contact number of the user (required, trimmed, unique)
 * - password: Hashed password of the user (required)
 * - accountType: Defines user role ("Student" or "Admin") (required)
 * - counselingPlan: ID of the user's current subscription plan (links to PLANS config)
 * - planActivationDate: Date the current plan became active
 * - paymentStatus: Status of the payment for the current plan ('Pending', 'Completed', 'Failed', null)
 * - paymentTransactionId: Reference ID from the payment gateway transaction
 * - collegeListGenerationsUsed: Counter for College List Generator usage (limit defined in PLANS config)
 * - timestamps: Automatically adds createdAt and updatedAt fields
 */

module.exports = mongoose.model("user", userSchema);