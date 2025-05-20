// config/plans.js (or your chosen path)

/**
 * Central configuration for subscription plans.
 * - Keys should match the 'id' used in the frontend pricing component ('starter', 'pro', 'accelerator').
 * - 'name': Display name of the plan.
 * - 'collegeListGeneratorLimit': The maximum number of times the college list generator can be used. Use Infinity for unlimited.
 * - 'priceId': The identifier for this plan/price in your payment gateway (e.g., Stripe Price ID, Razorpay Plan ID). Replace placeholders with actual IDs.
 * - 'amount': The price in the smallest currency unit (e.g., paisa for INR). Useful for backend verification.
 */
const PLANS = {
    // Corresponds to the 'starter' plan in Pricing.jsx
    'free': {
      name: 'Free',
      collegeListGeneratorLimit: 3, // From "Basic College List Generator (5 Uses)"
      priceId: null, // Free plan doesn't need a payment gateway price ID for charging
      amount: 0, // From frontend amount
    },
    'starter': {
      name: 'Starter Pack',
      collegeListGeneratorLimit: 3, // From "Basic College List Generator (5 Uses)"
      priceId: 'price_starter_1', // Free plan doesn't need a payment gateway price ID for charging
      amount: 100, // From frontend amount
    },
    // Corresponds to the 'pro' plan in Pricing.jsx
    'pro': {
      name: 'Guidance Pro',
      collegeListGeneratorLimit: 5, // From "Advanced College List Generator (25 Uses)"
      priceId: 'price_guidance_pro_799', // <<< IMPORTANT: Replace with your actual payment gateway Price/Plan ID for ₹799
      amount: 99900, // From frontend amount
    },
    // Corresponds to the 'accelerator' plan in Pricing.jsx
    'accelerator': {
      name: 'Admission Accelerator',
      // collegeListGeneratorLimit: Infinity, // From "Unlimited College List Generator Access"
      collegeListGeneratorLimit: 5,
      priceId: 'price_admission_accelerator_3999', // <<< IMPORTANT: Replace with your actual payment gateway Price/Plan ID for ₹3999
      amount: 159900, // From frontend amount
    }
  };
  
  module.exports = { PLANS }; // Use module.exports for CommonJS (Node.js backend)
  // Or export { PLANS }; for ES Modules if your backend uses that