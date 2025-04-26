// controller/courseController.js
const courseModule = require("../modules/courseModule");
const collegeModule = require("../modules/collegeModule");
const branchModule = require("../modules/branchModule");
const feeModule = require("../modules/feeModule");
const placementModule = require("../modules/placementModule");
const cutOffModule = require("../modules/cutoffModule");
const { createCourseAndDependencies } = require("../utils/creationHelpers"); // Import helper

// POST /apiv1/college/:collegeId/course - Add a new course to a college
exports.createCourseForCollege = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const courseData = req.body;

        const college = await collegeModule.findById(collegeId);
        if (!college) return res.status(404).json({ success: false, message: "College not found" });

        const newCourseId = await createCourseAndDependencies(courseData); // Use helper

        college.courses.push(newCourseId);
        await college.save();

        const populatedCourse = await courseModule.findById(newCourseId).populate(/* fields */).lean(); // Add population

        return res.status(201).json({ success: true, message: "Course added", course: populatedCourse });

    } catch (err) {
        console.error("Create course for college error:", err);
        return res.status(500).json({ success: false, message: "Failed add course", error: err.message });
    }
};

// GET /apiv1/course/:courseId - Get a single course
exports.getCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const course = await courseModule.findById(courseId)
            .populate({ path: "branches", populate: { path: "cutOffs", populate: { path: "image" } } })
            .populate("fees placement")
            .lean();

        if (!course) return res.status(404).json({ success: false, message: "Course not found" });
        return res.status(200).json({ success: true, course });
    } catch (err) {
        console.error("Get course error:", err);
        return res.status(500).json({ success: false, message:"Failed get course", error: err.message });
    }
};

// PUT /apiv1/course/:courseId - Update a course
exports.updateCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { name, duration } = req.body;
        if (!name && !duration) return res.status(400).json({ success: false, message: "No fields to update" });

        const updateData = {};
        if (name) updateData.name = name;
        if (duration) updateData.duration = duration;

        const updatedCourse = await courseModule.findByIdAndUpdate(courseId, { $set: updateData }, { new: true, runValidators: true }).lean();

        if (!updatedCourse) return res.status(404).json({ success: false, message: "Course not found" });
        return res.status(200).json({ success: true, message: "Course updated", course: updatedCourse });
    } catch (err) {
        console.error("Update course error:", err);
        return res.status(500).json({ success: false, message:"Failed update course", error: err.message });
    }
};

// DELETE /apiv1/course/:courseId - Delete a course
exports.deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const course = await courseModule.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });

        // 1. Remove course ref from Colleges
        await collegeModule.updateMany({ courses: courseId }, { $pull: { courses: courseId } });

        // 2. Delete associated Branches (and their Cutoffs)
        // TODO: Add cutoff image deletion if needed
        const branchesToDelete = course.branches || [];
        for (const branchId of branchesToDelete) {
            const branch = await branchModule.findById(branchId);
            if (branch && branch.cutOffs && branch.cutOffs.length > 0) {
                await cutOffModule.deleteMany({ _id: { $in: branch.cutOffs } });
            }
        }
        if (branchesToDelete.length > 0) await branchModule.deleteMany({ _id: { $in: branchesToDelete } });


        // 3. Delete associated Fees
        if (course.fees && course.fees.length > 0) await feeModule.deleteMany({ _id: { $in: course.fees } });

        // 4. Delete associated Placement
        if (course.placement) await placementModule.findByIdAndDelete(course.placement);

        // 5. Delete Course
        await courseModule.findByIdAndDelete(courseId);

        return res.status(200).json({ success: true, message: "Course deleted" });
    } catch (err) {
         console.error("Delete course error:", err);
        return res.status(500).json({ success: false, message:"Failed delete course", error: err.message });
    }
};