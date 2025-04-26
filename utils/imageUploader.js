// utils/imageUploader.js
const cloudinary = require("cloudinary").v2;

exports.uploadImageToCloudinary = async (file, folder, height, quality) => {
    const options = { folder };
    if (height) {
        options.height = height;
    }
    if (quality) {
        options.quality = quality;
    }
    options.resource_type = "auto"; // Let Cloudinary detect resource type

    // Ensure file and tempFilePath exist
    if (!file || !file.tempFilePath) {
        throw new Error("Invalid file object for upload.");
    }

    console.log("Cloudinary Upload Options:", options);
    console.log("Uploading file:", file.tempFilePath);

    return await cloudinary.uploader.upload(file.tempFilePath, options);
};