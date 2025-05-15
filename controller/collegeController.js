// controller/collegeController.js
const collegeModule = require("../modules/collegeModule");
const Course = require("../modules/courseModule");
const Fee = require("../modules/feeModule");
const ExamModule = require("../modules/examModule");
const Branch = require("../modules/branchModule");
const Placement = require("../modules/placementModule");
const slugify = require("slugify");
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

// // --- PUT /apiv1/college/:collegeId - Update College Top-Level Fields ---
// exports.updatecollege = async (req, res) => {
//     try {
//         const { collegeId } = req.params;
//         const courses = req.body.courses;
//         const updates = req.body;

//         // delete updates.courses; // Don't update courses array here
//         const updatedCollege = await collegeModule.findByIdAndUpdate(collegeId, { $set: updates }, { new: true, runValidators: true })
//             .populate(/* necessary fields */).lean(); // Add population

//         if (!updatedCollege) return res.status(404).json({ success: false, message: "College not found" });
//         return res.status(200).json({ success: true, message: "College updated", college: updatedCollege });
//     } catch (err) {
//          console.error("Update college error:", err);
//         if (err.code === 11000) return res.status(409).json({ success: false, message: `DTE Code already exists.` });
//         return res.status(500).json({ success: false, error: err.message, message: "Failed update college" });
//     }
// };



// --- PUT /apiv1/college/:collegeId - Update College (including courses) ---
exports.updatecollege = async (req, res) => {
    try {
        const { collegeId } = req.params;

        if (!req.body.data) {
            return res.status(400).json({ success: false, message: "Missing 'data' field in request body." });
        }

        const incomingData = { ...req.body.data }; // Clone incoming data

        // --- Manually update slug if name is changing ---
        if (incomingData.name) {
            incomingData.slug = slugify(incomingData.name, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
            console.log(`[updatecollege] Generated new slug: ${incomingData.slug} for name: ${incomingData.name}`);
        }
        // --- End Manual Slug Update ---

        // --- Process and Link Courses ---
        if (incomingData.courses && Array.isArray(incomingData.courses)) {
            const courseObjectIds = [];
            for (const courseData of incomingData.courses) {
                if (!courseData.name || !courseData.duration) {
                    console.warn("[updatecollege] Skipping a course due to missing name or duration:", courseData);
                    continue;
                }

                // --- Process Branches for the current course ---
                const branchObjectIds = [];
                if (courseData.branches && Array.isArray(courseData.branches)) {
                    for (const branchData of courseData.branches) {
                        if (!branchData.bName) {
                            console.warn("[updatecollege] Skipping a branch due to missing bName:", branchData);
                            continue;
                        }
                        // For cutoffs, the schema expects ObjectIds.
                        // If you send full cutoff objects, they need similar processing.
                        // For now, assuming cutOffs are handled separately or are simple.
                        // If cutOffs are ObjectIds, they should be passed as such.
                        // If they are full objects, they need to be created/updated in Cutoff collection.
                        // For simplicity here, we'll assume cutOffs are passed as ObjectIds if present, or empty.
                        let processedCutoffs = [];
                        if (branchData.cutOffs && Array.isArray(branchData.cutOffs)) {
                            // If cutOffs are full objects, you'd iterate and create/update them here,
                            // then push their _ids to processedCutoffs.
                            // For now, if they are just simple data or already ObjectIds:
                            // This part needs to align with how you manage cutoffs.
                            // If cutOffs are ObjectIds, this is fine. If objects, this will fail.
                            // To avoid error for now if they are objects, we'll just pass an empty array
                            // unless you implement full cutoff object processing.
                            // For this example, we'll assume cutOffs are not being deeply processed here.
                            // processedCutoffs = branchData.cutOffs; // This would fail if they are objects and schema expects ObjectId
                        }


                        let branchDoc = await Branch.findOneAndUpdate(
                            { bName: branchData.bName }, // Find by name (consider more unique criteria if needed)
                            { $set: { bName: branchData.bName, cutOffs: processedCutoffs } }, // Update/set cutoffs
                            { new: true, upsert: true, runValidators: true }
                        );
                        branchObjectIds.push(branchDoc._id);
                    }
                }

                // --- Process Fees for the current course ---
                const feeObjectIds = [];
                if (courseData.fees && Array.isArray(courseData.fees)) {
                    for (const feeData of courseData.fees) {
                        if (!feeData.category || typeof feeData.amt === 'undefined') {
                            console.warn("[updatecollege] Skipping a fee due to missing category or amount:", feeData);
                            continue;
                        }
                        let feeDoc = await Fee.findOneAndUpdate(
                            { category: feeData.category /*, add more criteria if fees are reusable */ },
                            { $set: feeData },
                            { new: true, upsert: true, runValidators: true }
                        );
                        feeObjectIds.push(feeDoc._id);
                    }
                }

                // --- Process Placements for the current course ---
                let placementObjectId = null;
                if (courseData.placements) { // Assuming one placement object per course
                    // If placements are unique per course, upsert based on some criteria or always create new
                    // For simplicity, let's assume we update if exists by some unique property or create new
                    // This part needs a robust way to identify if a placement record should be updated or created.
                    // For this example, we'll just create/update based on the presence of data.
                    // A more robust approach might involve a unique key or linking placement to courseId.
                    let placementDoc = await Placement.findOneAndUpdate(
                        { averageSalary: courseData.placements.averageSalary, highestSalary: courseData.placements.highestSalary }, // Example find criteria, might not be unique
                        { $set: courseData.placements },
                        { new: true, upsert: true, runValidators: true }
                    );
                    placementObjectId = placementDoc._id;
                }

                // Find or Create the Course document
                let courseDoc = await Course.findOneAndUpdate(
                    { name: courseData.name, duration: courseData.duration }, // Find criteria
                    {
                        $set: {
                            name: courseData.name,
                            duration: courseData.duration,
                            branches: branchObjectIds,
                            fees: feeObjectIds,
                            placement: placementObjectId,
                        }
                    },
                    { new: true, upsert: true, runValidators: true }
                );
                courseObjectIds.push(courseDoc._id);
            }
            incomingData.courses = courseObjectIds; // Replace array of objects with array of ObjectIds
        }

        console.log(`[updatecollege] Attempting to update college ${collegeId} with processed data:`, JSON.stringify(incomingData, null, 2));

        const updatedCollege = await collegeModule.findByIdAndUpdate(
            collegeId,
            { $set: incomingData },
            { new: true, runValidators: true }
        )
        .populate({
            path: 'courses',
            populate: [
                { path: 'branches', populate: { path: 'cutOffs' /*, populate: { path: 'image' } */ } },
                { path: 'fees' },
                { path: 'placement' }
            ]
        })
        .lean();

        if (!updatedCollege) {
            return res.status(404).json({ success: false, message: "College not found" });
        }

        console.log(`[updatecollege] College ${collegeId} updated successfully in DB.`);
        return res.status(200).json({ success: true, message: "College updated", college: updatedCollege });

    } catch (err) {
        console.error("[updatecollege] Update college error:", err);
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: `Update failed. DTE Code might already exist.` });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: "Validation Error", errors: err.errors });
        }
        if (err.name === 'CastError') {
            console.error("[updatecollege] Casting error. Path:", err.path, "Value:", err.value);
            return res.status(400).json({ success: false, message: `Invalid data format for field '${err.path}': ${err.reason?.message || err.message}`});
        }
        return res.status(500).json({ success: false, error: err.message, message: "Failed to update college" });
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

// --- GET /apiv1/college/:slug - Get a specific college by slug ---
exports.getCollegeBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        // Ensure your backend populates all necessary referenced fields (courses, placement, images)
        const college = await collegeModule.findOne({ slug })
            .populate({
                path: 'courses',
                populate: [
                    { path: 'branches', populate: { path: 'cutOffs' /*, model: 'Cutoff', populate: { path: 'image', model: 'Image' } */ } },
                    { path: 'fees' /*, model: 'Fee'*/ },
                    { path: 'placement' /*, model: 'Placement'*/ }
                ]
            })
            .populate('avatarImage') // Populate avatar
            .populate('images')     // Populate gallery images
            .populate('placement'); // Populate college-level placement

        if (!college) {
            return res.status(404).json({ success: false, message: "College not found with this slug" });
        }
        return res.status(200).json({ success: true, college });
    } catch (err) {
        console.error("Error fetching college by slug:", err);
        return res.status(500).json({ success: false, message: "Failed to get college details", error: err.message });
    }
};

// --- GET /apiv1/college - Get all colleges ---
exports.getAllColleges = async (req, res) => {
     try {
        const colleges = await collegeModule.find()
            .populate('avatarImage', 'imageUrl')
            .select('name slug location type dteCode avatarImage year affiliation')
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