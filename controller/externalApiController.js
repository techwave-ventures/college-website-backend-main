// File: controller/externalApiController.js

const axios = require('axios'); // Make sure axios is installed: npm install axios
require('dotenv').config(); // Ensure environment variables are loaded

/**
 * @route   GET /apiv1/college-images/search
 * @desc    Search Google Images for a given college name
 * @access  Public (or Protected if you only want logged-in users to trigger this indirectly)
 * @query   collegeName (string, required)
 */

exports.searchCollegeImagesGoogle = async (req, res) => {
    const { collegeName } = req.query;

    if (!collegeName) {
        return res.status(400).json({
            success: false,
            message: 'College name query parameter is required.'
        });
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const CSE_ID = process.env.GOOGLE_CSE_ID; // Your Custom Search Engine ID

    if (!GOOGLE_API_KEY || !CSE_ID) {
        console.error("SERVER ERROR: Google API Key or CSE ID is missing in backend environment variables.");
        return res.status(500).json({
            success: false,
            message: 'Image search service is not configured correctly on the server.'
        });
    }

    // --- MODIFICATION: Refined Search Query & Parameters ---
    // Option 1: More general query, might yield more results but some less specific
    // const searchQuery = `${collegeName} campus`;
    // Option 2: More specific, but might yield fewer if terms are too restrictive
    const searchQuery = `${collegeName} college campus building`; // Slightly adjusted
    // Option 3: Try adding "official" or "photo"
    // const searchQuery = `${collegeName} official campus photo`;

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=8&safe=active&imgType=photo`;
    // Increased num to 8 to get more options
    // Added imgType=photo to prioritize photographs over logos, line art etc.
    // You can also experiment with imgSize (e.g., imgSize=medium or imgSize=large)
    // --- END MODIFICATION ---

    console.log(`[searchCollegeImagesGoogle] Searching Google Images for: "${searchQuery}" with URL: ${searchUrl}`);

    try {
        const googleApiResponse = await axios.get(searchUrl);

        if (googleApiResponse.data && googleApiResponse.data.items && googleApiResponse.data.items.length > 0) {
            const images = googleApiResponse.data.items.map(item => ({
                imageUrl: item.link,
                altText: item.title,
                sourcePage: item.image?.contextLink,
                mime: item.mime // Include mime type
            })).filter(image => image.imageUrl && (image.mime === 'image/jpeg' || image.mime === 'image/png' || image.mime === 'image/webp')); // Filter for common web image types

            console.log(`[searchCollegeImagesGoogle] Found and filtered ${images.length} images for "${collegeName}".`);
            if (images.length === 0) {
                 console.log(`[searchCollegeImagesGoogle] No suitable image types (jpeg, png, webp) found for "${collegeName}" after filtering.`);
            }
            return res.status(200).json({ success: true, images: images });
        } else {
            console.log(`[searchCollegeImagesGoogle] No items found in Google API response for "${collegeName}". Response:`, googleApiResponse.data);
            return res.status(200).json({ success: true, images: [] }); // Success, but no images
        }
    } catch (error) {
        console.error('[searchCollegeImagesGoogle] Error fetching images from Google Custom Search API:', error.response?.data?.error || error.message);
        let errorMessage = 'Failed to fetch images from Google due to a server error.';
        if (error.response?.data?.error?.message) {
            errorMessage = `Google API Error: ${error.response.data.error.message}`;
        }
        return res.status(error.response?.status || 500).json({
            success: false,
            message: errorMessage
        });
    }
};




/**
 * @route   GET /apiv1/college/videos/search (or similar based on your routing)
 * @desc    Search YouTube for videos related to a given college name
 * @access  Public (or Protected)
 * @query   collegeName (string, required)
 */
exports.searchCollegeVideosYouTube = async (req, res) => {
    const { collegeName } = req.query;

    if (!collegeName) {
        return res.status(400).json({
            success: false,
            message: 'College name query parameter is required.'
        });
    }

    const YOUTUBE_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

    if (!YOUTUBE_API_KEY) {
        console.error("SERVER ERROR: YouTube Data API Key is missing in backend environment variables.");
        return res.status(500).json({
            success: false,
            message: 'Video search service is not configured correctly on the server.'
        });
    }

    // Construct the YouTube Data API v3 search URL
    // Search for videos like campus tours, reviews, or official channel content.
    const searchQuery = `${collegeName} campus review`;
    // Fetch a few relevant videos, focusing on video type.
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=3&key=${YOUTUBE_API_KEY}`;

    console.log(`[searchCollegeVideosYouTube] Searching YouTube for: "${searchQuery}"`);

    try {
        const youtubeApiResponse = await axios.get(searchUrl);

        if (youtubeApiResponse.data && youtubeApiResponse.data.items) {
            const videos = youtubeApiResponse.data.items.map(item => ({
                videoId: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails.default.url, // Or .medium.url / .high.url
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt,
            }));
            console.log(`[searchCollegeVideosYouTube] Found ${videos.length} videos for "${collegeName}".`);
            return res.status(200).json({ success: true, videos: videos });
        } else {
            console.log(`[searchCollegeVideosYouTube] No videos found or unexpected YouTube API response for "${collegeName}".`);
            return res.status(200).json({ success: true, videos: [] }); // Success, but no videos
        }
    } catch (error) {
        console.error('[searchCollegeVideosYouTube] Error fetching videos from YouTube Data API:', error.response?.data?.error || error.message);
        let errorMessage = 'Failed to fetch videos from YouTube due to a server error.';
        if (error.response?.data?.error?.message) {
            errorMessage = `YouTube API Error: ${error.response.data.error.message}`;
        }
        return res.status(error.response?.status || 500).json({
            success: false,
            message: errorMessage
        });
    }
};