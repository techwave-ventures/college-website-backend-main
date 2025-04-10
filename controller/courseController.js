const collegeModule = require("../modules/collegeModule");
const cutOffModule = require("../modules/cutoffModule");
const branchModule = require("../modules/branchModule");
const courseModule = require("../modules/courseModule");
const ExamModule = require("../modules/examModule");

exports.createCourses = async (req, res) => {
  try {
    const { collegeId, data } = req.body || "";
    const courses = data?.courses || [];
    let courseArray = [];

    courses.forEach(async (course) => {
      const branches = course.branches || [];
      const fees = course.fees || [];
      const placements = course.placements || {};
      let branchArray = [];
      let feesArray = [];

      //create courses
      branches.forEach(async (branch) => {
        let cutoffArray = [];
        branch.cutOffs.forEach(async (cutoff) => {
          const createdCutoff = await cutOffModule.create({
            name: cutoff.name,
            image: cutoff.image,
          });
          cutoffArray.push(createdCutoff._id);
        });
        const createdBranch = await branchModule.create({
          bName: branch.bName,
          cutOffs: cutoffArray,
        });
        branchArray.push(createdBranch._id);
      });

      fees.forEach(async (fee) => {
        const createdFee = await feeModule.create({
          category: fee.category,
          amt: fee.amount,
        });
        feesArray.push(createdFee._id);
      });

      const createdPlacement = await placementModule.create({
        averageSalary: placements.averageSalary,
        highestSalary: placements.highestSalary,
      });

      const createdCourse = await courseModule.create({
        name: course.name,
        duration: course.duration,
        branches: branchArray,
        fees: feesArray,
        placements: createdPlacement._id,
      });
      courseArray.push(createdCourse._id);
    });

    const updateCollege = await collegeModule.findByIdAndUpdate(collegeId, {
      $push: { courses: courseArray },
    });
    if (!updateCollege) {
      return res.status(400).json({
        success: false,
        message: "college not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Courses created successfully",
      data: updateCollege,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
