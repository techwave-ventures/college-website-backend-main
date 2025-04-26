// controller/branchController.js
const branchModule = require("../modules/branchModule");
const courseModule = require("../modules/courseModule");
const cutOffModule = require("../modules/cutoffModule");
// const imageModule = require("../modules/imageModule"); // Import if deleting cutoff images

// POST /apiv1/course/:courseId/branch - Add a new branch to a course
exports.createBranchForCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { bName, cutOffs = [] } = req.body;

        if (!bName) return res.status(400).json({ success: false, message: "Branch name required" });

        const course = await courseModule.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });

        const cutoffPromises = cutOffs.map(async (cutoff) => {
            if (!cutoff.name) throw new Error(`Cutoff name missing`);
            const createdCutoff = await cutOffModule.create({ name: cutoff.name, image: cutoff.image || null });
            return createdCutoff._id;
        });
        const cutoffArray = await Promise.all(cutoffPromises);

        const newBranch = await branchModule.create({ bName: bName, cutOffs: cutoffArray });

        course.branches.push(newBranch._id);
        await course.save();

        const populatedBranch = await branchModule.findById(newBranch._id).populate(/* cutoffs? */).lean(); // Add population

        return res.status(201).json({ success: true, message: "Branch added", branch: populatedBranch });

    } catch (err) {
        console.error("Create branch error:", err);
        return res.status(500).json({ success: false, message: "Failed add branch", error: err.message });
    }
};

// GET /apiv1/branch/:branchId - Get a single branch
exports.getBranch = async (req, res) => {
     try {
        const { branchId } = req.params;
        const branch = await branchModule.findById(branchId)
            .populate({ path: 'cutOffs', populate: { path: 'image' }})
            .lean();

        if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
        return res.status(200).json({ success: true, branch });
    } catch (err) {
        console.error("Get branch error:", err);
        return res.status(500).json({ success: false, message:"Failed get branch", error: err.message });
    }
};

// PUT /apiv1/branch/:branchId - Update a branch
exports.updateBranch = async (req, res) => {
     try {
        const { branchId } = req.params;
        const { bName } = req.body;
        if (!bName) return res.status(400).json({ success: false, message: "Branch name required" });

        const updatedBranch = await branchModule.findByIdAndUpdate(branchId, { $set: { bName: bName } }, { new: true, runValidators: true }).lean();

        if (!updatedBranch) return res.status(404).json({ success: false, message: "Branch not found" });
        return res.status(200).json({ success: true, message: "Branch updated", branch: updatedBranch });
    } catch (err) {
        console.error("Update branch error:", err);
        return res.status(500).json({ success: false, message:"Failed update branch", error: err.message });
    }
};

// DELETE /apiv1/branch/:branchId - Delete a branch
exports.deleteBranch = async (req, res) => {
    try {
        const { branchId } = req.params;
        const branch = await branchModule.findById(branchId);
        if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

        // 1. Remove branch ref from Courses
        await courseModule.updateMany({ branches: branchId }, { $pull: { branches: branchId } });

        // 2. Delete associated Cutoffs
        // TODO: Add image deletion if needed
        if (branch.cutOffs && branch.cutOffs.length > 0) {
            await cutOffModule.deleteMany({ _id: { $in: branch.cutOffs } });
        }

        // 3. Delete Branch
        await branchModule.findByIdAndDelete(branchId);

        return res.status(200).json({ success: true, message: "Branch deleted" });
    } catch (err) {
         console.error("Delete branch error:", err);
        return res.status(500).json({ success: false, message:"Failed delete branch", error: err.message });
    }
};