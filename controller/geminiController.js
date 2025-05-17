// File: controller/geminiController.js (or externalApiController.js)

const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Initialize Gemini Client
let genAI;
let geminiModel;

if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    // console.log("[GeminiController] Gemini AI Client initialized with model: gemini-1.5-flash-latest");
} else {
    // console.error("[GeminiController] FATAL ERROR: GEMINI_API_KEY is missing. Gemini features will not work.");
}

/**
 * @route   GET /apiv1/gemini/college-info/:collegeName  (Ensure this route is correctly defined in your routes file)
 * @desc    Use Gemini API to fetch/generate details for a given college name
 * @access  Public (or Protected, depending on your needs)
 * @params  collegeName (string, required from URL path)
 */
exports.getCollegeDetailsWithGemini = async (req, res) => {
    const { collegeName } = req.params;

    if (!geminiModel) {
        return res.status(500).json({
            success: false,
            message: "Gemini AI service is not configured or API key is missing on the server."
        });
    }

    if (!collegeName) {
        return res.status(400).json({
            success: false,
            message: 'College name parameter is required.'
        });
    }

    // console.log(`[getCollegeDetailsWithGemini] Request for college: "${collegeName}"`);

    // --- MODIFIED Prompt for Gemini ---
    const prompt = `
        Provide detailed information about the engineering college named "${collegeName}".
        If it's in Maharashtra, India, focus on aspects relevant to MHT-CET admissions.
        Structure the output as a JSON object with a top-level key "college".
        The "college" object should include the following fields if information is found:
        - name: (string) The full official name of the college.
        - desc: (string) A detailed description of the college in 200 words
        - dteCode: (number) The DTE (Directorate of Technical Education) code for Maharashtra engineering colleges (e.g., 5179 for Vishwabharati Academy's College of Engineering, Ahmednagar). If not found or not applicable, use null.
        - location: (string) City and State, e.g., "Ahmednagar, Maharashtra".
        - year: (string) Year of establishment (e.g., "2007").
        - affiliation: (string) Affiliating university, e.g., "Savitribai Phule Pune University (SPPU)".
        - type: (string) e.g., "Private Unaided", "Government Autonomous".
        - admissionProcess: (string) A summary of the admission process, mentioning MHT-CET or JEE Main if applicable.
        - infrastructure: (array of strings) List key infrastructure facilities (e.g., "Well-equipped Laboratories", "Central Library", "Hostel", "Mess/Canteen", "Transportation",).
        - review: (string) A general review summary of the college, campus, academics, faculty, placements
        - courses: (array of objects) For popular engineering programs like "BE/B.Tech". Each course object should have:
            - name: (string) e.g., "BE/B.Tech"
            - duration: (string) e.g., "4 Years"
            - branches: (array of objects) List all engineering branches that collge offers. Each branch object should have:
                - bName: (string) e.g., "Computer Engineering", "Information Technology", "Mechanical Engineering".
            - fees: (array of objects) Example fee structure for a few categories if available. Each fee object should have:
                - category: (string) e.g., "OPEN", "OBC".
                - amt: (number) Approximate annual fee in INR.
            - placements: (object) Example placement data if available, with:
                - averageSalary: (number) Approximate average salary in LPA (Lakhs Per Annum).
                - highestSalary: (number) Approximate highest salary in LPA.

        If specific data for fields like exact fees for all categories, or very detailed placements for "${collegeName}" is not readily available in your knowledge, provide the most plausible information for an engineering college of its type in that region or state, or state "Information Not Readily Available" or use null for numerical fields where appropriate.
        Ensure the output is a valid JSON object. Do not include any explanatory text before or after the JSON object itself. Start directly with { and end with }.
    `;
    // --- END MODIFIED Prompt ---

    try {
        // console.log(`[getCollegeDetailsWithGemini] Sending prompt to Gemini for "${collegeName}"...`);
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        let textResponse = response.text();

        // console.log(`[getCollegeDetailsWithGemini] Raw response from Gemini for "${collegeName}":\n>>>\n${textResponse}\n<<<`);

        let jsonData;
        try {
            textResponse = textResponse.replace(/^```json\s*/im, '').replace(/\s*```$/im, '');
            textResponse = textResponse.trim();
            const firstBrace = textResponse.indexOf('{');
            const lastBrace = textResponse.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const jsonString = textResponse.substring(firstBrace, lastBrace + 1);
                // console.log(`[getCollegeDetailsWithGemini] Attempting to parse extracted JSON string:\n${jsonString}`);
                jsonData = JSON.parse(jsonString);
            } else {
                throw new Error("Could not find valid JSON object delimiters '{' and '}' in the response.");
            }
        } catch (parseError) {
            // console.error(`[getCollegeDetailsWithGemini] Failed to parse Gemini response as JSON for "${collegeName}":`, parseError);
            // console.error(`[getCollegeDetailsWithGemini] Gemini Raw Text (after initial cleaning) was: ${textResponse}`);
            return res.status(500).json({
                success: false,
                message: "Received an invalid format from AI. Could not structure college details.",
                rawResponse: textResponse
            });
        }

        if (jsonData && jsonData.college) {
            // console.log(`[getCollegeDetailsWithGemini] Successfully parsed Gemini response for "${collegeName}".`);
            // --- Ensure DTE code from Gemini is a number or null ---
            if (jsonData.college.dteCode && typeof jsonData.college.dteCode !== 'number') {
                const parsedDte = parseInt(jsonData.college.dteCode, 10);
                jsonData.college.dteCode = isNaN(parsedDte) ? null : parsedDte;
            } else if (typeof jsonData.college.dteCode === 'undefined') {
                 jsonData.college.dteCode = null;
            }
            // --- Ensure year is a string ---
            if (jsonData.college.year && typeof jsonData.college.year !== 'string') {
                jsonData.college.year = String(jsonData.college.year);
            }


            return res.status(200).json({ success: true, college: jsonData.college });
        } else {
            // console.warn(`[getCollegeDetailsWithGemini] Gemini response for "${collegeName}" did not contain the expected 'college' key or was empty after parsing.`);
            return res.status(500).json({
                success: false,
                message: "AI service returned an unexpected data structure after parsing.",
                parsedResponse: jsonData
            });
        }

    } catch (error) {
        // console.error(`[getCollegeDetailsWithGemini] Error interacting with Gemini API for "${collegeName}":`, error);
        const googleApiErrorMessage = error.response?.data?.error?.message || error.message;
        return res.status(500).json({
            success: false,
            message: "Failed to fetch college details using AI service.",
            error: googleApiErrorMessage
        });
    }
};