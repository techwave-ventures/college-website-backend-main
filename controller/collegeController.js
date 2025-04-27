// controller/collegeController.js
const collegeModule = require("../modules/collegeModule");
const courseModule = require("../modules/courseModule");
const feeModule = require("../modules/feeModule");
const ExamModule = require("../modules/examModule");
const { createCourseAndDependencies } = require("../utils/creationHelpers"); // Import helper

// --- POST /apiv1/college - Create a new College ---
exports.createcollege = async (req, res) => {
    try {
        const { examId, data } = req.body;

        if (!data || !examId) return res.status(400).json({ success: false, message: "Missing required fields (examId, data)" });
        if (!data.name || !data.dteCode) return res.status(400).json({ success: false, message: "Missing required college fields (name, dteCode)" });

        const { courses = [], ...collegeData } = data;
        let courseIdArray = [];

        if (courses.length > 0) {
            const courseCreationPromises = courses.map(course => createCourseAndDependencies(course));
            courseIdArray = await Promise.all(courseCreationPromises);
        }

        const createdcollege = await collegeModule.create({
            ...collegeData, courses: courseIdArray,
            avatarImage: collegeData.avatarImage || null, images: collegeData.images || [],
            placement: collegeData.placement || null,
        });

        const exam = await ExamModule.findById(examId);
        if (exam) { exam.colleges.push(createdcollege._id); await exam.save(); }
        else { console.warn(`Exam ID ${examId} not found creating college ${createdcollege._id}`); }

        const populatedCollege = await collegeModule.findById(createdcollege._id).populate(/* deep population as before */).lean(); // Add population here

        return res.status(201).json({ success: true, message: "College created", college: populatedCollege });
    } catch (err) {
        console.error("Create college error:", err);
        if (err.code === 11000) return res.status(409).json({ success: false, message: `DTE Code already exists.` });
        return res.status(500).json({ success: false, error: err.message, message: "Failed create college" });
    }
};

// --- PUT /apiv1/college/:collegeId - Update College Top-Level Fields ---
exports.updatecollege = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const courses = req.body.courses;
        delete req.body.courses;

        const updates = req.body;

        // delete updates.courses; // Don't update courses array here
        const updatedCollege = await collegeModule.findByIdAndUpdate(collegeId, { $set: updates }, { new: true, runValidators: true })
            .populate(/* necessary fields */).lean(); // Add population

        if (!updatedCollege) return res.status(404).json({ success: false, message: "College not found" });
        return res.status(200).json({ success: true, message: "College updated", college: updatedCollege });
    } catch (err) {
         console.error("Update college error:", err);
        if (err.code === 11000) return res.status(409).json({ success: false, message: `DTE Code already exists.` });
        return res.status(500).json({ success: false, error: err.message, message: "Failed update college" });
    }
};

// --- GET /apiv1/college/:collegeId - Get a specific college by ID ---
exports.getcollege = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const college = await collegeModule.findById(collegeId)
             .populate('avatarImage images placement') // Populate top level refs
             .populate({ // Deep populate courses
                path: "courses",
                populate: [
                    { path: "branches", populate: { path: "cutOffs", populate: { path: "image" } } },
                    { path: "fees" }, { path: "placement" }
                 ],
             })
            .lean();
        if (!college) return res.status(404).json({ success: false, message: "College not found" });
        return res.status(200).json({ success: true, college });
    } catch (err) {
         console.error("Get college error:", err);
         return res.status(500).json({ success: false, message: "Failed get college", error: err.message });
    }
};

// --- GET /apiv1/college - Get all colleges ---
exports.getAllColleges = async (req, res) => {
     try {
        const colleges = await collegeModule.find()
            .populate('avatarImage', 'imageUrl')
            .select('name location type dteCode avatarImage year affiliation')
            .lean();
        return res.status(200).json({ success: true, count: colleges.length, colleges });
    } catch (err) {
        console.error("Get all colleges error:", err);
        return res.status(500).json({ success: false, message:"Failed get colleges", error: err.message });
    }
};

// --- DELETE /apiv1/college/:collegeId - Delete a college ---
exports.deleteCollege = async (req, res) => {
     try {
        const { collegeId } = req.params;
        const college = await collegeModule.findById(collegeId);
        if (!college) return res.status(404).json({ success: false, message: 'College not found' });

        // TODO: Implement thorough cleanup (courses, exams, images etc.) before deleting
        // Example: await courseModule.deleteMany({ _id: { $in: college.courses } }); // Needs more robust cleanup

        await collegeModule.findByIdAndDelete(collegeId);
        return res.status(200).json({ success: true, message: 'College deleted successfully' });
    } catch (err) {
        console.error("Delete college error:", err);
        return res.status(500).json({ success: false, message:"Failed delete college", error: err.message });
    }
};