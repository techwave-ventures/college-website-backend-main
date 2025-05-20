// config/database.js
const mongoose = require("mongoose");
require("dotenv").config(); // Ensure dotenv is configured

const MONGODB_URL = process.env.MONGODB_URL;

exports.connect = () => {
    if (!MONGODB_URL) {
        console.error("FATAL ERROR: MONGODB_URL environment variable is not set.");
        process.exit(1);
    }
    mongoose.connect(MONGODB_URL, {
        // useNewUrlParser: true, // Deprecated but good practice if using older Mongoose
        // useUnifiedTopology: true, // Deprecated
    })
    .then(() => {
        console.log("DB Connection established successfully.");
    })
    .catch((error) => {
        console.error("DB Connection Failed:");
        console.error(error);
        process.exit(1); // Exit process on connection failure
    });
};