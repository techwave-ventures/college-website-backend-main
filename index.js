// server.js (or index.js)
const express = require("express");
const mongoose = require("mongoose"); // Make sure mongoose is required if used directly (like in DB connection)
const cookieParser = require("cookie-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const fileUpload = require("express-fileupload");
const axios = require('axios'); // For heartbeat

// Load environment variables FIRST
dotenv.config();

// --- Import Configs & Services ---
const database = require("./config/database");
const { cloudinaryConnect } = require("./config/cloudinary");

// --- Import Routers ---
const authRouter = require("./routes/authRoutes");
const userRoutes = require('./routes/userRoutes');
const collegeRouter = require("./routes/collegeRoutes");
const courseRouter = require("./routes/courseRoutes");
const branchRouter = require("./routes/branchRoutes");
const examRouter = require("./routes/examRoutes");
const imageRouter = require("./routes/imageRoutes");
const paymentRouter = require("./routes/paymentRoutes");
const geminiRouter = require("./routes/geminiRoutes"); // Import Gemini router
const toolsRouter = require("./routes/toolsRoutes"); // Import tools router
// Add other routers if needed

const app = express();
const PORT = process.env.PORT || 5000;

// --- Environment Variables ---
// Define allowed origins based on environment variables
const allowedOrigins = [
    'http://localhost:5173',
    'https://college-website-frontend-sage.vercel.app',
    process.env.FRONTEND_URL_PROD1,     // e.g., https://your-live-site.com
    process.env.FRONTEND_URL_PROD2,     // e.g., https://another-live-site.com
    // Add any other specific origins you need to allow
].filter(Boolean); // Filter out undefined/null values if env vars aren't set

// Add a default local URL if none are provided in .env during development
if (process.env.NODE_ENV === 'development' && allowedOrigins.length === 0) {
    allowedOrigins.push('http://localhost:3000');
}

// console.log("Allowed CORS Origins:", allowedOrigins);

const COOKIE_SECRET = process.env.COOKIE_SECRET; // Get secret for cookie parser

// --- Connect DB & Cloudinary ---
database.connect(); // Assuming this function handles connection logic
cloudinaryConnect(); // Assuming this function handles connection logic

// --- Middleware Pipeline (Correct Order) ---

// 1. CORS Middleware - Handle cross-origin requests first
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        // OR if origin is in the allowedOrigins list
        if (!origin || allowedOrigins.includes(origin)) {
             // console.log(`CORS allowed for origin: ${origin || 'N/A'}`); // Optional: logging
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`);
            callback(new Error(`Origin '${origin}' not allowed by CORS`)); // Provide specific error
        }
    },
    credentials: true, // Essential for sending/receiving cookies cross-origin
}));

// 2. Body Parsers - Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // If you need to parse form data

// 3. Cookie Parser - Parse cookies (needs to be after CORS, before routes using cookies)
// Initialize with secret for potential signed cookie usage
app.use(cookieParser(COOKIE_SECRET));

// 4. File Upload Middleware - Handle file uploads
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
}));

// --- API Routes ---
// Mount routers after core middleware
app.use("/apiv1/auth", authRouter);
app.use('/apiv1/users', userRoutes);
app.use("/apiv1/college", collegeRouter);
app.use("/apiv1/course", courseRouter);
app.use("/apiv1/branch", branchRouter);
app.use("/apiv1/exam", examRouter);
app.use("/apiv1/image", imageRouter);
app.use("/apiv1/payments", paymentRouter); // Payment routes
app.use("/apiv1/gemini", geminiRouter); // Gemini routes
app.use("/apiv1/tools", toolsRouter); // Tools routes

// Add other routes here

// --- Health Check / Keep-Alive Routes ---
app.get("/hailing", (req, res) => {
    return res.status(200).json({ success: true, message: "Server is awake and responsive" });
});

app.get("/", (req, res) => {
    return res.json({ success: true, message: "College Counseling Backend API is Running..." });
});

// --- Final Error Handling Middleware ---
// Must be defined AFTER all other app.use() and routes
app.use((err, req, res, next) => {
    console.error("Unhandled Application Error:", err.message);
    console.error(err.stack); // Log the stack trace for debugging

    // Check if it's a CORS error we generated
    if (err.message.includes('not allowed by CORS')) {
        return res.status(403).json({ // 403 Forbidden is appropriate for CORS issues
             success: false,
             message: err.message // Send the specific CORS error message
        });
    }

    // Handle other errors (e.g., validation errors, database errors)
    // You might want to add more specific error handling here based on err.name or err.statusCode
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "An unexpected server error occurred.",
        // Optionally include error type in development for easier debugging
        // errorType: process.env.NODE_ENV === 'development' ? err.name : undefined
    });
});


// --- Server Activation ---
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

// --- Heartbeat for Render/Free Tier Hosting ---
const HEARTBEAT_URL = process.env.HEARTBEAT_URL || 'https://college-website-backend-main.onrender.com/hailing'; // Use env var or default

function callSelfApi() {
    if (!HEARTBEAT_URL) {
        console.warn("Heartbeat URL not configured. Skipping heartbeat.");
        return;
    }
    // console.log(`Sending heartbeat to: ${HEARTBEAT_URL}`); // Optional logging
    axios.get(HEARTBEAT_URL)
        .then(response => {
            console.log('Heartbeat Success:', response.data?.message || 'OK', "at", new Date().toLocaleTimeString());
        })
        .catch(error => {
            console.error('Heartbeat Error calling API:', HEARTBEAT_URL, error.message);
        });
}

function scheduleApiCall() {
    if (!HEARTBEAT_URL) return; // Don't schedule if URL isn't set
    console.log(`Scheduling heartbeat API call to ${HEARTBEAT_URL} every 14 minutes.`);
    callSelfApi(); // Call immediately on start
    setInterval(callSelfApi, 14 * 60 * 1000); // Repeat every 14 minutes
}

// Schedule the heartbeat call
scheduleApiCall();