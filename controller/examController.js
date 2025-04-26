// controller/examController.js
const examModule = require("../modules/examModule");

exports.createExam = async(req,res) => {
    try{
        const {name} = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Exam name required" });

        const createdExam = await examModule.create({ name: name });

        return res.status(201).json({ success: true, message: "Exam created", exam: createdExam });
    } catch(err) {
        console.error("Create exam error:", err);
        return res.status(500).json({ success: false, message: "Failed create exam", error: err.message }); // Corrected status field name
    }
};

// GET /apiv1/exam/:id - Get a single exam by ID
exports.getExam = async (req, res) => {
    try {
        const { id } = req.params;
        const exam = await examModule.findById(id).populate('colleges', 'name dteCode').lean(); // Populate colleges lightly

        if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

        return res.status(200).json({ success: true, exam });
    } catch (err) {
         console.error("Get exam error:", err);
         return res.status(500).json({ success: false, message: "Failed get exam", error: err.message });
    }
};

// GET /apiv1/exam - Get all exams
exports.getAllExams = async (req, res) => {
    try {
        const exams = await examModule.find().select('name').lean(); // Select only name for list

        return res.status(200).json({ success: true, count: exams.length, exams });
    } catch (err) {
        console.error("Get all exams error:", err);
        return res.status(500).json({ success: false, message: "Failed get exams", error: err.message });
    }
};
// Note: Add PUT/DELETE for exams if needed