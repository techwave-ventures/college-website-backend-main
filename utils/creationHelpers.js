// utils/creationHelpers.js
// (Helper function moved here for reusability)
const courseModule = require("../modules/courseModule");
const branchModule = require("../modules/branchModule");
const cutOffModule = require("../modules/cutoffModule");
const feeModule = require("../modules/feeModule");
const placementModule = require("../modules/placementModule");

exports.createCourseAndDependencies = async (courseData) => {
    const { branches = [], fees = [], placements = {}, name, duration } = courseData;

    // Basic validation at the start
    if (!name || !duration) {
        throw new Error(`Course creation failed: Name or duration missing.`);
    }

    // 1. Create Placement for the course
    const createdPlacement = await placementModule.create({
        averageSalary: placements.averageSalary || 0,
        highestSalary: placements.highestSalary || 0,
    });

    // 2. Create Fees for the course (parallel)
    const feePromises = fees.map(async (fee) => {
        if (!fee.category || typeof fee.amount === 'undefined') {
            throw new Error(`Fee data incomplete for course '${name}': ${JSON.stringify(fee)}`);
        }
        const createdFee = await feeModule.create({
            category: fee.category,
            amt: fee.amount,
        });
        return createdFee._id;
    });
    const feesArray = await Promise.all(feePromises);

    // 3. Create Branches and their Cutoffs (parallel branches, parallel cutoffs within branch)
    const branchPromises = branches.map(async (branch) => {
        const { cutOffs = [], bName } = branch;
         if (!bName) throw new Error(`Branch name missing for course '${name}': ${JSON.stringify(branch)}`);

        const cutoffPromises = cutOffs.map(async (cutoff) => {
             if (!cutoff.name) throw new Error(`Cutoff name missing for branch '${bName}': ${JSON.stringify(cutoff)}`);
            const createdCutoff = await cutOffModule.create({
                name: cutoff.name,
                image: cutoff.image || null, // Allow null image ObjectId
            });
            return createdCutoff._id;
        });
        const cutoffArray = await Promise.all(cutoffPromises);

        const createdBranch = await branchModule.create({
            bName: bName,
            cutOffs: cutoffArray,
        });
        return createdBranch._id;
    });
    const branchArray = await Promise.all(branchPromises);

    // 4. Create the Course document
    const createdCourse = await courseModule.create({
        name: name,
        duration: duration,
        branches: branchArray,
        fees: feesArray,
        placement: createdPlacement._id,
    });

    return createdCourse._id; // Return the ID of the created course
};