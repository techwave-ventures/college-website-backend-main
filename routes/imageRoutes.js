const express = require("express")
const router = express.Router()

const {uploadImage, getImage, getAllImages} = require("../controller/imageController");

router.post("/",uploadImage);
router.get("/:imageId/", getImage);
router.get("/", getAllImages);

module.exports = router
