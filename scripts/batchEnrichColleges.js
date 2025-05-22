// File: scripts/batchEnrichColleges.js

const axios = require('axios');
const dotenv = require('dotenv');
const mongoose = require('mongoose'); // For main connection management
const { enrichCollegeData } = require('./enrichCollegeDataWithGemini'); // Import the function

dotenv.config(); // Load environment variables from .env file

const API_BASE_URL = process.env.API_BASE_URL_INTERNAL || "https://backend.campussathi.in/apiv1";
const MONGODB_URI = process.env.MONGODB_URL;
const BACKEND_AUTH_TOKEN = process.env.YOUR_BACKEND_AUTH_TOKEN_FOR_SCRIPT; // If your /college GET route is protected

// Axios instance for fetching all colleges
const mainApiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_AUTH_TOKEN && { 'Authorization': `Bearer ${BACKEND_AUTH_TOKEN}` })
    }
});

// Delay function to avoid hitting API rate limits too quickly
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function batchEnrichAllColleges() {
    if (!MONGODB_URI) {
        console.error("MONGODB_URI not found in environment variables. Batch script cannot run.");
        process.exit(1);
    }
    if (!process.env.GEMINI_API_KEY) { // Check if GEMINI_API_KEY is set for the imported function
        console.error("GEMINI_API_KEY not found in environment variables. Batch script cannot run.");
        process.exit(1);
    }

    let mainConnection;
    try {
        console.log('Batch Script: Connecting to MongoDB for the batch operation...');
        // It's better if enrichCollegeData doesn't manage its own connection when run in batch.
        // However, since it currently does, this main connection here is just for the batch script itself if needed.
        // The current enrichCollegeData will open/close its own.
        // For true efficiency, enrichCollegeData should accept a mongoose connection instance.
        // For now, we'll proceed with its current connection management.
        await mongoose.connect(MONGODB_URI);
        console.log('Batch Script: MongoDB Connected.');

        console.log(`Fetching all colleges from: ${API_BASE_URL}/college`);
        const response = await mainApiClient.get('/college'); // Assuming this endpoint returns all colleges

        if (!response.data || !response.data.success || !Array.isArray(response.data.colleges)) {
            console.error("Failed to fetch colleges or invalid format received.");
            return;
        }

        const allColleges = response.data.colleges;
        console.log(`Found ${allColleges.length} colleges to process.`);

        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < allColleges.length; i++) {
            const college = allColleges[i];
            // Use DTE code as the primary identifier, fallback to slug or _id
            const identifier = college.dteCode || college.slug || college._id;

            if (!identifier) {
                console.warn(`Skipping college due to missing identifier: ${college.name}`);
                failureCount++;
                continue;
            }

            console.log(`\nProcessing college ${i + 1} of ${allColleges.length}: ${college.name} (Identifier: ${identifier})`);
            try {
                const result = await enrichCollegeData(identifier.toString()); // Ensure identifier is a string
                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                    console.error(`Failed to enrich ${college.name}: ${result.message}`);
                }
            } catch (e) {
                failureCount++;
                console.error(`Critical error processing ${college.name}: ${e.message}`);
            }

            // Add a delay to be respectful to APIs (Gemini and your own)
            // Adjust delay as needed (e.g., Gemini free tier has low QPM)
            if (i < allColleges.length - 1) { // Don't delay after the last item
                const delayTime = 5000; // 5 seconds delay
                console.log(`Waiting for ${delayTime / 1000} seconds before next college...`);
                await delay(delayTime);
            }
        }

        console.log("\n--- Batch Processing Summary ---");
        console.log(`Successfully enriched: ${successCount} college(s)`);
        console.log(`Failed to enrich: ${failureCount} college(s)`);

    } catch (error) {
        console.error('Error during batch enrichment script:', error.response ? error.response.data : error.message);
    } finally {
        // The enrichCollegeData function handles its own disconnect.
        // If you had a main connection for the batch script, disconnect here.
        // if (mongoose.connection.readyState === 1) {
        //     await mongoose.disconnect();
        //     console.log('Batch Script: MongoDB Disconnected.');
        // }
        console.log("Batch script finished.");
    }
}

// Run the batch script
batchEnrichAllColleges();