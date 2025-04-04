const examModule = require("../modules/examModule");

exports.createExam = async(req,res) => {
    try{

        const {name} = req.body;

        const createdExam = await examModule.create({
            name: name
        })

        return res.status(201).json({
            success: true,
            message: "Exam created successfully",
            body: createdExam
        });

    } catch(err) {
        return res.status(500).json({
            status: false,
            message:err.message
        })
    }
}

exports.getExam = async (req, res) => {
    try {
        const exams = await examModule.find(); // Fetch all exams

        return res.status(200).json({
            success: true,
            message: "Exams retrieved successfully",
            body: exams
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
