// controllers/toolsController.js

const axios = require('axios'); // For making HTTP requests from backend
const { PLANS } = require('../config/plans'); // Adjust path as needed
const User = require('../modules/userModule'); // Adjust path as needed

// External Generator API URL (from your frontend code)
const EXTERNAL_GENERATOR_URL = 'https://pref-list-new.onrender.com/preference-list';

// Branch cluster data (needed to expand clusters on backend)
// IMPORTANT: Keep this consistent with the frontend definition
const branchClusterMap = {
  "Computer & IT": ["Computer Engineering", "Computer Engineering (Software Engineering)", "Computer Science", "Computer Science and Business Systems", "Computer Science and Design", "Computer Science and Engineering", "Computer Science and Information Technology", "Computer Science and Technology", "Computer Technology", "Information Technology"],
  "AI/ML/DS": ["Artificial Intelligence", "Artificial Intelligence (AI) and Data Science", "Artificial Intelligence and Data Science", "Artificial Intelligence and Machine Learning", "Computer Science and Engineering (Artificial Intelligence and Data Science)", "Computer Science and Engineering (Artificial Intelligence)", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)", "Computer Science and Engineering(Data Science)", "Data Engineering", "Data Science", "Robotics and Artificial Intelligence"],
  "Cybersecurity & IoT": ["Computer Science and Engineering (Cyber Security)", "Computer Science and Engineering (Internet of Things and Cyber Security Including Block Chain Technology)", "Computer Science and Engineering (IoT)", "Computer Science and Engineering(Cyber Security)", "Cyber Security", "Industrial IoT", "Internet of Things (IoT)"],
  "Electronics & TeleComm": ["5G", "Electrical and Computer Engineering", "Electrical and Electronics Engineering", "Electronics Engineering", "Electronics Engineering ( VLSI Design and Technology)", "Electronics and Communication (Advanced Communication Technology)", "Electronics and Communication Engineering", "Electronics and Communication(Advanced Communication Technology)", "Electronics and Computer Engineering", "Electronics and Computer Science", "Electronics and Telecommunication Engg", "VLSI"],
  "Electrical": ["Electrical Engg [Electrical and Power]", "Electrical Engg[Electronics and Power]", "Electrical Engineering"],
  "Mechanical & Automation": ["Automation and Robotics", "Automobile Engineering", "Manufacturing Science and Engineering", "Mechanical & Automation Engineering", "Mechanical Engineering", "Mechanical Engineering[Sandwich]", "Mechanical and Mechatronics Engineering (Additive Manufacturing)", "Mechatronics Engineering", "Production Engineering", "Production Engineering[Sandwich]", "Robotics and Automation"],
  "Civil": ["Civil Engineering", "Civil Engineering and Planning", "Civil and Environmental Engineering", "Civil and infrastructure Engineering", "Structural Engineering"],
  "Chemical & Allied": ["Chemical Engineering", "Dyestuff Technology", "Fibres and Textile Processing Technology", "Oil Fats and Waxes Technology", "Oil Technology", "Oil and Paints Technology", "Oil,Oleochemicals and Surfactants Technology", "Paints Technology", "Paper and Pulp Technology", "Petro Chemical Engineering", "Petro Chemical Technology", "Pharmaceutical and Fine Chemical Technology", "Pharmaceuticals Chemistry and Technology", "Plastic Technology", "Plastic and Polymer Engineering", "Plastic and Polymer Technology", "Polymer Engineering and Technology", "Surface Coating Technology", "Textile Chemistry"],
  "Other Engineering": ["Aeronautical Engineering", "Agricultural Engineering", "Bio Medical Engineering", "Bio Technology", "Electronics and Biomedical Engineering", "Fashion Technology", "Food Engineering and Technology", "Food Technology", "Food Technology And Management", "Instrumentation Engineering", "Instrumentation and Control Engineering", "Logistics", "Man Made Textile Technology", "Metallurgy and Material Technology", "Mining Engineering", "Printing Technology", "Safety and Fire Engineering", "Textile Engineering / Technology", "Textile Plant Engineering", "Textile Technology"]
};


/**
 * @route   POST /apiv1/tools/generate-preference-list
 * @desc    Protected route to generate preference list, checking plan & usage limits
 * @access  Protected (Requires authentication middleware)
 * @body    { percentile: number, category: string, selectedClusters?: string[], selectedIndividualBranches?: string[], places: string[] }
 */
exports.generatePreferenceList = async (req, res) => {
    const userId = req.user?.id; // From auth middleware

    if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required." });
    }

    // console.log(`[generatePreferenceList] Request received from user: ${userId}`);

    // 1. Extract and Validate Input Data from Request Body
    const {
        percentile,
        category,
        selectedClusters = [], // Default to empty array if not provided
        selectedIndividualBranches = [], // Default to empty array
        places
    } = req.body;

    // Basic input validation
    const percentileNum = parseFloat(percentile);
    if (isNaN(percentileNum) || percentileNum < 0 || percentileNum > 100) {
        return res.status(400).json({ success: false, message: 'Invalid percentile. Must be between 0 and 100.' });
    }
    if (!category || typeof category !== 'string') {
        return res.status(400).json({ success: false, message: 'Category is required.' });
    }
    if (!Array.isArray(selectedClusters) || !Array.isArray(selectedIndividualBranches) || !Array.isArray(places)) {
         return res.status(400).json({ success: false, message: 'Invalid format for selections (clusters, branches, places must be arrays).' });
    }
    if (selectedClusters.length === 0 && selectedIndividualBranches.length === 0) {
        return res.status(400).json({ success: false, message: 'Please select at least one branch cluster or individual branch.' });
    }
    if (places.length === 0) {
        return res.status(400).json({ success: false, message: 'Please select at least one place.' });
    }

    try {
        // 2. Fetch User and Check Plan/Status
        const user = await User.findById(userId)
            .select('counselingPlan paymentStatus collegeListGenerationsUsed collegeListGenerationLimit') // Select only necessary fields
            .lean(); // Use lean for read-only operations

        if (!user) {
            // console.error(`[generatePreferenceList] User not found: ${userId}`);
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const planId = user.counselingPlan;
        const planDetails = PLANS[planId];

        // Check if the plan exists and is valid
        if (!planDetails) {
            // console.warn(`[generatePreferenceList] User ${userId} has invalid or no plan (${planId}). Access denied.`);
            return res.status(403).json({ success: false, message: "A valid subscription plan is required to use this feature." });
        }

        // Check payment status for paid plans
        // Allow 'starter' plan regardless of paymentStatus (which should be null anyway)
        if (planId !== 'free' && user.paymentStatus !== 'Completed') {
            // console.warn(`[generatePreferenceList] User ${userId} plan (${planId}) is not active (Status: ${user.paymentStatus}). Access denied.`);
            return res.status(403).json({ success: false, message: `Your '${planDetails.name}' plan is not active. Please complete payment or contact support.` });
        }

        // 3. Check Usage Limit
        const limit = user.collegeListGenerationLimit; // Get limit from PLANS config
        const currentUsage = user.collegeListGenerationsUsed;

        // console.log(`[generatePreferenceList] User ${userId}, Plan: ${planId}, Usage: ${currentUsage}/${limit}`);

        if (currentUsage >= limit) {
            // console.warn(`[generatePreferenceList] User ${userId} reached usage limit (${currentUsage}/${limit}) for plan ${planId}. Access denied.`);
            return res.status(403).json({ success: false, message: `Usage Limit Reached. Buy more limit to continue` });
        }

        // 4. Prepare Data for External API
        // Combine branches from clusters and individual selections
        let finalBranches = new Set(selectedIndividualBranches);
        selectedClusters.forEach(clusterName => {
            const branchesInCluster = branchClusterMap[clusterName] || [];
            branchesInCluster.forEach(branch => finalBranches.add(branch));
        });
        const uniqueBranchesArray = Array.from(finalBranches);

        // Construct query parameters
        const queryParams = new URLSearchParams({
            percentile: percentileNum.toString(), // Ensure percentile is string
            category: category,
        });
        uniqueBranchesArray.forEach((b) => queryParams.append('branches', b));
        places.forEach((p) => queryParams.append('places', p));

        const externalApiUrl = `${EXTERNAL_GENERATOR_URL}?${queryParams.toString()}`;
        // console.log(`[generatePreferenceList] Calling external API for user ${userId}: ${externalApiUrl}`);

        // 5. Call External Generator API
        const apiResponse = await axios.get(externalApiUrl, {
             timeout: 30000 // Add a timeout (e.g., 30 seconds)
        });

        // Check if the external API call was successful (axios throws for non-2xx status)
        // console.log(`[generatePreferenceList] External API call successful for user ${userId}. Status: ${apiResponse.status}`);

        // 6. Increment Usage Count on Success
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $inc: { collegeListGenerationsUsed: 1 } },
            { new: true } // Optional: return the updated document
        );
        // console.log(`[generatePreferenceList] Incremented usage for user ${userId}. New count: ${updatedUser?.collegeListGenerationsUsed}`);

        // 7. Return Generated List to Frontend
        return res.status(200).json({ success: true, data: apiResponse.data });

    } catch (error) {
        // Handle different types of errors
        if (axios.isAxiosError(error)) {
            // console.error(`[generatePreferenceList] Axios error calling external API for user ${userId}:`, error.response?.data || error.message);
            // Try to forward the error message from the external API if available
            const externalErrorMsg = error.response?.data?.message || error.message || "Failed to generate list from external service.";
            const statusCode = error.response?.status || 502; // 502 Bad Gateway if external service fails
            return res.status(statusCode).json({ success: false, message: `Generator Service Error: ${externalErrorMsg}` });
        } else {
            // Handle database errors or other unexpected errors
            // console.error(`[generatePreferenceList] Internal server error for user ${userId}:`, error);
            return res.status(500).json({ success: false, message: "An internal server error occurred." });
        }
    }
};