const collegeModule = require("../modules/collegeModule");
const cutOffModule = require("../modules/cutoffModule");
const branchModule = require("../modules/branchModule");
const courseModule = require("../modules/courseModule");
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
      description: data.description,
      dteCode: data.dteCode,
      avatarImage: data.avatarImage || "",
      images: data.images || [],
      year: data.year,
      affiliation: data.affiliation,
      type: data.type,
      admissionProcess: data.admissionProcess,
      infrastructure: data.infrastructure,
      review: data.reviews,
      placement: data.placement,
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
    const { collegeId, data } = req.body;

    const {
      name,
      location,
      year,
      affiliation,
      type,
      admissionProcess,
      infrastructure,
      review,
      avatarImage,
      images,
      placement,
      courses = [],
    } = data;

    const college = await collegeModule.findById(collegeId);
    if (!college) {
      return res.status(404).json({
        success: false,
        message: "College not found",
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
    college.avatarImage = avatarImage || college.avatarImage;
    college.images = images || college.images;
    college.placement = placement || college.placement;
    college.courses = updatedCourseArray;

    await college.save();

    return res.status(200).json({
      success: true,
      message: "College updated successfully",
      college,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      message: "Something went wrong in update",
    });
  }
};

exports.getcollege = async (req, res) => {
  try {
    const { collegeId } = req.params;

    const college = await collegeModule
      .findById(collegeId)
      .populate({
        path: "courses",
        populate: [
          {
            path: "branches",
            populate: {
              path: "cutOffs",
            },
          },
          {
            path: "fees",
          },
          {
            path: "placements",
          },
        ],
      })
      .populate("placement") // top-level college.placement
      .lean();

    if (!college) {
      return res.status(404).json({
        success: false,
        message: "College not found",
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
      message: "Something went wrong in getcollege",
    });
  }
};
