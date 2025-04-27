const examModel = require("./modules/examModule");
const collegeModel = require("./modules/collegeModule");

const script = async () => {
    try {
      const colleges = await collegeModel.find();
      const collegeIds = colleges.map(college => college._id);

    //   console.log(await examModel.find());

  
      // Use updateOne with $push and $each to add all IDs
      const exam = await examModel.updateOne(
        { _id: "67efb09306ba3717625ac492" },
        { $push: { colleges: { $each: collegeIds } } }
      );
      console.log(exam);
  
      if (exam.matchedCount === 0) {
        console.log("Exam 'cet' not found.");
      } else if (exam.modifiedCount > 0) {
        console.log("Successfully added all college IDs to the 'cet' exam.");
      } else {
        console.log("No changes were made.  The 'cet' exam might already have all the college IDs, or there might be no new colleges to add.");
      }
  
  
    } catch (error) {
      console.error("Error updating exam:", error);
    }
  };

script();
