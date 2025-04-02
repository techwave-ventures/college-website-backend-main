const collegeModule = require("../modules/collegeModule");
const cutOffModule = require("../modules/cutOffModule");
const branchModule = require("../modules/branchModule");
const courseModule = require("../modules/CourseModule");
const ExamModule = require("../modules/examModule");

// /college -> post

exports.createcollege = async (req, res) => {
  try {
    const { examId, data } = req.body || "";

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

    const createdcollege = await collegeModule.create({
      name: data.name,
      location: data.location,
      year: data.year,
      affiliation: data.affiliation,
      type: data.type,
      admissionProcess: data.admissionProcess,
      infrastructure: data.infrastructure,
      review: data.reviews,
      courses: courseArray,
    });

    // add college in exam
    const exam = await ExamModule.findById(examId);
    exam.colleges.push(createdcollege);
    await exam.save();

    return res.status(201).json({
      success: true,
      message: "college created",
      college: createdcollege,
      exam: exam,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      message: "Something went wrong in catch block",
    });
  }
};

exports.updatecollege = async (req, res) => {
  try {
    const {
      collegeId,
      name,
      location,
      year,
      affiliation,
      type,
      admissionProcess,
      infrastructure,
      review,
      courses,
      branches,
      placement,
    } = req.body;

    // Find the college by ID
    let college = await collegeModule.findById(collegeId);
    if (!college) {
      return res.status(404).json({
        success: false,
        message: "college not found",
      });
    }

    // Update college fields
    college.name = name || college.name;
    college.location = location || college.location;
    college.year = year || college.year;
    college.affiliation = affiliation || college.affiliation;
    college.type = type || college.type;
    college.admissionProcess = admissionProcess || college.admissionProcess;
    college.infrastructure = infrastructure || college.infrastructure;
    college.review = review || college.review;
    college.courses = courses || college.courses;

    // Update branches if provided
    if (branches) {
      college.branches = branches;
    }

    // Update placement if provided
    if (placement) {
      college.placement = placement;
    }

    // Save the updated college
    await college.save();

    return res.status(200).json({
      success: true,
      message: "college updated successfully",
      college,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      message: "Something went wrong",
    });
  }
};

exports.getcollege = async (req, res) => {
  try {
    const { collegeId } = req.params;
    let collegeQuery = collegeModule.findById(collegeId);

    const collegeExists = await collegeModule
      .findById(collegeId)
      .select("branches placement")
      .lean(); // Fetch required fields

    if (collegeExists?.branches && collegeExists.branches.length > 0) {
      collegeQuery = collegeQuery.populate("branches"); // Populate only if not empty
    }

    if (collegeExists?.placement) {
      collegeQuery = collegeQuery.populate("placement");
    }

    const college = await collegeQuery.lean(); // Convert to plain object once at the end

    if (!college) {
      return res.status(402).json({
        success: false,
        message: "college not found",
      });
    }

    return res.status(200).json({
      success: true,
      college,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      message: "Something went wrong",
    });
  }
};
