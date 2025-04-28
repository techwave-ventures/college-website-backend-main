// server.js (or app.js)
const express = require("express");
const app = express();

// Configuration and Middleware
const database = require("./config/database");
const { cloudinaryConnect } = require("./config/cloudinary");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const fileUpload = require("express-fileupload");
const axios = require('axios'); // For heartbeat

// Import Routers
// const authRouter = require("./routes/authRoutes"); // Assuming you have this - Keep commented if code not provided
const collegeRouter = require("./routes/collegeRoutes");
const courseRouter = require("./routes/courseRoutes"); // Handles /course/:id routes
const branchRouter = require("./routes/branchRoutes"); // Handles /branch/:id routes
const examRouter = require("./routes/examRoutes");
const imageRouter = require("./routes/imageRoutes");
// Add other routers (placement, fee, cutoff) if you create them

// Load environment variables (still useful for PORT, DB_URI, Cloudinary keys, JWT_SECRET etc.)
dotenv.config();
const PORT = process.env.PORT || 5000;

// Connect DB & Cloudinary
database.connect();
cloudinaryConnect();

// Standard Middleware
app.use(express.json()); // Parse JSON bodies
app.use(cookieParser()); // Parse cookies

// Apply CORS using specific origins from the previous version
app.use(cors({
    origin: [*], // Specific origins
    credentials: true,
}));

// File Upload Middleware
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/", // Standard temp directory
}));

// --- API Routes ---
// Mount the routers - using the structure from the refined version
// app.use("/apiv1/auth", authRouter); // Keep commented if not implemented
app.use("/apiv1/college", collegeRouter); // Handles /college, /college/:id/*, /college/:id/placement, /college/:id/course
app.use("/apiv1/course", courseRouter);   // Handles /course/:id, /course/:id/branch
app.use("/apiv1/branch", branchRouter);   // Handles /branch/:id
app.use("/apiv1/exam", examRouter);
app.use("/apiv1/image", imageRouter);
// Add other routes here if needed

// --- Health Check / Keep-Alive Routes ---
app.get("/hailing", (req, res) => {
    // console.log("Hailing route hit at", new Date().toISOString());
    return res.status(200).json({ success: true, message: "Server is awake" }); // Message updated for clarity
});

// Root route for basic check
app.get("/", (req, res) => {
    return res.json({ success: true, message: "College Counseling Backend is Running..." }); // Message updated
});

// --- Server Activation ---
app.listen(PORT, () => {
    console.log(`App is listening at http://localhost:${PORT}`);
});

// --- Heartbeat for Render/Free Tier Hosting ---
const HEARTBEAT_URL = 'https://college-website-backend.onrender.com/hailing'; // Specific URL from previous version

function callSelfApi() {
    // console.log(`Sending heartbeat to: ${HEARTBEAT_URL}`);
    axios.get(HEARTBEAT_URL) // Use the specific URL
        .then(response => {
            // Log success message from the response, more informative
            console.log('Heartbeat Success:', response.data?.message || 'OK', "at", new Date().toLocaleTimeString());
        })
        .catch(error => {
            // Log the specific URL that failed
            console.error('Heartbeat Error calling API:', HEARTBEAT_URL, error.message);
        });
}

function scheduleApiCall() {
    console.log(`Scheduling heartbeat API call to ${HEARTBEAT_URL} every 14 minutes.`);
    callSelfApi(); // Call immediately on start
    setInterval(callSelfApi, 14 * 60 * 1000); // Repeat every 14 minutes
}

// Always schedule the heartbeat call, as in the previous version
scheduleApiCall();

