// File: scripts/enrichCollegeDataWithGemini.js

const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data'); // For file uploads
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
const College = require('../modules/collegeModule'); // Adjust path

// Load environment variables from .env file in the parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- Configuration ---
// API_BASE_URL should point to your running backend instance
const API_BASE_URL = process.env.API_BASE_URL_INTERNAL || "https://backend.campussathi.in/apiv1";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Load from environment variable
const MONGODB_URI = process.env.MONGODB_URL; // Load from environment variable
const BACKEND_AUTH_TOKEN = process.env.YOUR_BACKEND_AUTH_TOKEN_FOR_SCRIPT;

// Initialize Gemini Client
let genAI;
let geminiModel;

if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    console.log("Gemini AI Client initialized.");
} else {
    console.error("FATAL ERROR: GEMINI_API_KEY is missing in environment variables. Script cannot run.");
    process.exit(1);
}

// --- Axios instance for backend calls ---
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_AUTH_TOKEN && { 'Authorization': `Bearer ${BACKEND_AUTH_TOKEN}` })
    }
});

async function downloadImageAsBuffer(imageUrl) {
    try {
        console.log(`Downloading image from: ${imageUrl}`);
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data, 'binary');
    } catch (error) {
        console.error(`Error downloading image from ${imageUrl}:`, error.message);
        return null;
    }
}

async function uploadImageToBackend(imageBuffer, originalFileName) {
    if (!imageBuffer) return null;
    const formData = new FormData();
    formData.append('file', imageBuffer, {
        filename: originalFileName || `avatar-${Date.now()}.jpg`,
        contentType: 'image/jpeg',
    });

    try {
        // Ensure this endpoint matches your backend route for image uploads
        console.log(`Uploading image to backend endpoint: ${API_BASE_URL}/image`); // Assuming /upload is part of the path
        const response = await apiClient.post(`/image`, formData, { // Changed back to /image/upload as per common practice
            headers: {
                ...formData.getHeaders(),
                ...(BACKEND_AUTH_TOKEN && { 'Authorization': `Bearer ${BACKEND_AUTH_TOKEN}` })
            }
        });
        if (response.data.success && response.data.image?._id) {
            console.log("Image uploaded successfully to backend. Image ID:", response.data.image._id);
            return response.data.image._id;
        } else {
            console.error("Backend image upload failed or did not return expected data:", response.data.message);
            return null;
        }
    } catch (error) {
        console.error("Error uploading image to backend:", error.response ? error.response.data : error.message);
        return null;
    }
}

async function enrichCollegeData(collegeIdentifier) {
    if (!MONGODB_URI) { // Check for MONGODB_URI
        console.error("MONGODB_URI not found in environment variables.");
        process.exit(1);
    }
    if (!geminiModel) {
        console.error("Gemini model not initialized. Check GEMINI_API_KEY.");
        process.exit(1);
    }

    let collegeId = collegeIdentifier;

    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI); // Use MONGODB_URI from env
        console.log('MongoDB Connected Successfully.');

        let existingCollege;
        if (mongoose.Types.ObjectId.isValid(collegeIdentifier)) {
            existingCollege = await College.findById(collegeIdentifier).lean();
        } else {
            existingCollege = await College.findOne({
                $or: [{ dteCode: parseInt(collegeIdentifier) }, { slug: collegeIdentifier }]
            }).lean();
        }

        if (!existingCollege) {
            console.error(`College not found with identifier: ${collegeIdentifier}`);
            await mongoose.disconnect(); return;
        }
        collegeId = existingCollege._id.toString();
        console.log(`Fetched existing data for: ${existingCollege.name} (ID: ${collegeId})`);

        const contextForGemini = {
            name: existingCollege.name,
            dteCode: existingCollege.dteCode,
            year: existingCollege.year,
            affiliation: existingCollege.affiliation,
            type: existingCollege.type,
            location: existingCollege.location
        };

        const prompt = `
            Provide detailed information about the engineering college named "${existingCollege.name}".
            If it's in Maharashtra, India, focus on aspects relevant to MHT-CET admissions.
            Structure the output as a JSON object with a top-level key "updatedCollegeData" containing these fields:


            Existing Context:
            ${JSON.stringify(contextForGemini, null, 2)}

            - name: (string) Full official name.
            - desc: (string) The enhanced description.
            - dteCode: (number or null) DTE code.
            - location: (string) City and State.
            - year: (string) Year of establishment.
            - affiliation: (string) Affiliating university.
            - type: (string) e.g., "Private Unaided".
            - admissionProcess: (string) Enhanced admission process summary.
            - infrastructure: (array of strings) Enhanced list of infrastructure.
            - review: (string) Enhanced general review summary.
            Do NOT include a "courses" field in your response.
            Start your response directly with { and end with }. No explanations before or after the JSON.
        `;

        console.log(`Sending request to Gemini for "${existingCollege.name}"...`);
        const geminiResult = await geminiModel.generateContent(prompt);
        const geminiResponse = await geminiResult.response;
        let geminiTextResponse = geminiResponse.text();
        console.log("Raw Gemini Response:\n>>>\n", geminiTextResponse, "\n<<<");

        let parsedGeminiData;
        try {
            geminiTextResponse = geminiTextResponse.replace(/^```json\s*/im, '').replace(/\s*```$/im, '').trim();
            const firstBrace = geminiTextResponse.indexOf('{');
            const lastBrace = geminiTextResponse.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                parsedGeminiData = JSON.parse(geminiTextResponse.substring(firstBrace, lastBrace + 1));
            } else { throw new Error("Valid JSON delimiters not found in Gemini response."); }
        } catch (e) {
            console.error("Failed to parse Gemini response as JSON:", e);
            console.error("Gemini raw text was:", geminiTextResponse);
            await mongoose.disconnect(); return;
        }

        if (!parsedGeminiData || !parsedGeminiData.updatedCollegeData) {
            console.error("Gemini response does not contain 'updatedCollegeData' key or is invalid.");
            await mongoose.disconnect(); return;
        }

        const enrichedData = parsedGeminiData.updatedCollegeData;
        console.log("Enriched Data from Gemini:", JSON.stringify(enrichedData, null, 2));

        const updatePayload = {
            name: enrichedData.name || existingCollege.name,
            description: enrichedData.desc || existingCollege.description,
            dteCode: (typeof enrichedData.dteCode === 'number' && enrichedData.dteCode > 0) ? enrichedData.dteCode : existingCollege.dteCode,
            location: enrichedData.location || existingCollege.location,
            year: enrichedData.year || existingCollege.year,
            affiliation: enrichedData.affiliation || existingCollege.affiliation,
            type: enrichedData.type || existingCollege.type,
            admissionProcess: enrichedData.admissionProcess || existingCollege.admissionProcess,
            infrastructure: (enrichedData.infrastructure && enrichedData.infrastructure.length > 0) ? enrichedData.infrastructure : existingCollege.infrastructure,
            review: enrichedData.review || existingCollege.review,
        };

        if (!existingCollege.avatarImage && existingCollege.name) {
            console.log(`No existing avatar for ${existingCollege.name}. Fetching images from Google...`);
            try {
                // Ensure this path matches your backend route for image search
                const imageSearchResponse = await apiClient.get(`/college/college-images/search?collegeName=${encodeURIComponent(existingCollege.name)}`);
                if (imageSearchResponse.data.success && imageSearchResponse.data.images && imageSearchResponse.data.images.length > 0) {
                    const firstImageUrl = imageSearchResponse.data.images[0].imageUrl;
                    console.log(`Found Google Image: ${firstImageUrl}. Attempting to download and upload...`);
                    const imageBuffer = await downloadImageAsBuffer(firstImageUrl);
                    if (imageBuffer) {
                        const urlParts = firstImageUrl.split('/');
                        const suggestedFileName = urlParts[urlParts.length - 1].split('?')[0] || `avatar_${existingCollege.name.replace(/\s+/g, '_')}.jpg`;
                        console.log(`Suggested filename for upload: ${suggestedFileName}`);
                        const uploadedImageId = await uploadImageToBackend(imageBuffer, suggestedFileName);
                        if (uploadedImageId) {
                            updatePayload.avatarImage = uploadedImageId;
                            console.log(`Avatar image will be updated with new ID: ${uploadedImageId}`);
                        } else {
                            console.warn("Failed to upload new avatar image from Google Search.");
                        }
                    }
                } else {
                    console.log("No images found via Google Search for avatar.");
                }
            } catch (imgErr) {
                console.error("Error during Google Image search or upload process:", imgErr.message);
            }
        }

        console.log(`Sending PUT request to update college ID: ${collegeId} with payload:`, JSON.stringify({ data: updatePayload }, null, 2));
        const updateResponse = await apiClient.put(`/college/${collegeId}`, { data: updatePayload });

        if (updateResponse.data.success) {
            console.log("College data successfully updated in your database via backend API!");
            console.log("Updated College:", JSON.stringify(updateResponse.data.college, null, 2));
        } else {
            console.error("Backend API failed to update college:", updateResponse.data.message);
        }

    } catch (error) {
        console.error('Error during enrichCollegeData script:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('MongoDB Disconnected.');
        }
    }
}

const collegeIdentifierArg = process.argv[2];
if (!collegeIdentifierArg) {
    console.error("Please provide a college ID, DTE code, or slug as a command line argument.");
    process.exit(1);
}
enrichCollegeData(collegeIdentifierArg);