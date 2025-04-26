// controller/imageController.js
const Image = require("../modules/imageModule");
const { uploadImageToCloudinary } = require("../utils/imageUploader");
const dotenv = require("dotenv");
dotenv.config(); // Ensure env vars are loaded

const FOLDER_NAME = process.env.FOLDER_NAME || "default_folder"; // Provide default

exports.uploadImage = async(req, res) =>{
    try{
        // Check if file exists
        if (!req.files || !req.files.file) {
            return res.status(400).json({ success: false, message: "No image file uploaded" });
        }
        const displayPicture = req.files.file;

        // Upload to Cloudinary
        const image = await uploadImageToCloudinary(
            displayPicture,
            FOLDER_NAME, // Use env variable or default
            1000, // Example height constraint
            90    // Example quality constraint
        );

        // Check Cloudinary response
        if (!image || !image.secure_url) {
             throw new Error("Cloudinary upload failed or did not return a secure URL.");
        }

        // Create image record in DB
        const createdImage = await Image.create({
            imageUrl: image.secure_url,
            // Optionally store public_id if needed for deletion:
            // publicId: image.public_id
        });

        return res.status(200).json({
            // success:true, // Corrected typo from 'succes'
            success: true,
            message: "Image Uploaded successfully",
            image: createdImage // Return DB record
        });

    } catch(err){
        console.error("Image Upload Error:", err);
        return res.status(500).json({
            success: false,
            message: "Image upload failed",
            error: err.message
        });
    }
};

exports.getImage = async(req,res) => {
    try{
        const {imageId} = req.params;

        // Removed redundant !imageId check as route wouldn't match without it

        const image = await Image.findById(imageId).lean();

        if(!image){
            return res.status(404).json({ // Use 404 Not Found
                success:false,
                message:"Image not found"
            });
        }

        return res.status(200).json({
            success:true,
            image
        });

    } catch(err){
        console.error("Get Image Error:", err);
         // Handle potential CastError for invalid ObjectId format
        if (err.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Invalid Image ID format" });
        }
        return res.status(500).json({
            success: false,
            message: "Failed to get image",
            error: err.message
        });
    }
};

exports.getAllImages = async(req,res) => {
    try{
        const images = await Image.find().select('imageUrl createdAt').lean(); // Select specific fields

        return res.status(200).json({
            success:true,
            count: images.length,
            images
        });

    } catch(err) {
        console.error("Get All Images Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to get images",
            error: err.message
        });
    }
};
// Note: Add DELETE for images if needed (requires Cloudinary deletion logic too)