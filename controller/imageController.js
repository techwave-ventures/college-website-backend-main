const Image = require("../modules/imageModule");
const {uploadImageToCloudinary} = require("../utils/imageUploader");

exports.uploadImage = async(req, res) =>{
    try{

        const displayPicture = req.files.file
        const image = await uploadImageToCloudinary(
            displayPicture,
            process.env.FOLDER_NAME,
            1000,
            1000
        )

        const createdImage = await Image.create({
            imageUrl: image.secure_url,
        });

        return res.status(200).json({
            succes:true,
            message: "Image Uploaded",
            createdImage
        })

    } catch(err){
        return res.status(500).json({
            success: false,
            message: err.message
        })
    }
}

exports.getImage = async(req,res) => {
    try{

        const {imageId} = req.params;

        if(!imageId){
            return res.status(402).json({
                success:false,
                message:"Image id not found"
            })
        }

        const image = await Image.findById(imageId);

        if(!image){
            return res.status(402).json({
                success:false,
                message:"Image not found"
            })
        }

        return res.status(200).json({
            success:true,
            image
        })

    } catch(err){
        return res.status(500).json({
            success: false,
            message: err.message
        })
    }
}

exports.getAllImages = async(req,res) => {
    try{

        const images = await Image.find();

        return res.status(200).json({
            success:true,
            images
        })

    } catch(err) {
        return res.status(500).json({
            success: false,
            message: err.message
        })
    }
} 
