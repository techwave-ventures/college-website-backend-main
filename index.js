const express = require("express");
const app = express();

const database = require("./config/database");
const {cloudinaryConnect} = require("./config/cloudinary");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const fileUpload = require("express-fileupload");

const authRouter = require("./routes/authRoutes");
const collegeRouter = require("./routes/collegeRoutes");
const examRouter = require("./routes/examRoutes");
const imageRouter = require("./routes/imageRoutes");

const PORT = process.env.PORT || 5000;

dotenv.config();

database.connect();
cloudinaryConnect();
 
app.use(express.json());
app.use(cookieParser());
app.use(
	cors({
		origin: "*",
		credentials: true,
	})
);

app.use(
	fileUpload({
		useTempFiles: true,
		tempFileDir: "/tmp/",
	})
);

//routes
app.use("/apiv1/auth", authRouter)
app.use("/apiv1/college", collegeRouter)
app.use("/apiv1/exam", examRouter);
app.use("/apiv1/image", imageRouter);
app.use("/hailing",(req,res)=>{
    //console.log("hailing route");
    return res.status(200).json({
        success:true,
        message:"hailing route",
    })
})

app.get("/", (req, res) => {
	return res.json({
		success: true,
		message: "Your server is up and running ...",
	});
});

app.listen(PORT, () => {
	console.log(`App is listening at ${PORT}`);
});


const axios = require('axios');

function callSelfApi() {
    axios.get('https://college-website-backend.onrender.com/hailing')
        .then(response => {
            console.log('API Response:', response.data);
        })
        .catch(error => {
            console.error('Error calling API:', error.message);
        });
}


function scheduleApiCall() {
    callSelfApi(); 
    setInterval(callSelfApi, 14 * 60 * 1000);
}


scheduleApiCall();
