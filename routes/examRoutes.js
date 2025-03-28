const express = require("express")
const router = express.Router()

const {createExam} = require("../controller/examController")

router.post("/",createExam);


module.exports = router
