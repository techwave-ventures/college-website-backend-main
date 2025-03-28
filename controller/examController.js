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