// controller/placementController.js
const placementModule = require("../modules/placementModule");
const collegeModule = require("../modules/collegeModule");

// POST /apiv1/college/:collegeId/placement - Creates/Updates COLLEGE level placement
exports.createPlacement = async(req,res) =>{
    try {
        const { averageSalary, highestSalary } = req.body; // Corrected variable names
        const { collegeId } = req.params;

        const college = await collegeModule.findById(collegeId);
        if (!college) {
            return res.status(404).json({ success: false, message: "College not found" });
        }

        let placementData;
        // Check if college already has placement data, if so update it, else create new
        if (college.placement) {
             placementData = await placementModule.findByIdAndUpdate(
                 college.placement,
                 { averageSalary: averageSalary, highestSalary: highestSalary },
                 { new: true, runValidators: true } // Create if not found is not needed here
             );
        } else {
             placementData = await placementModule.create({
                averageSalary: averageSalary,
                highestSalary: highestSalary
            });
            college.placement = placementData._id; // Assign new placement ID
            await college.save();
        }

        return res.status(201).json({
            success:true,
            message:"College placement data created/updated successfully",
            placement: placementData,
        });

    } catch(err) {
        console.error("Create/Update placement error:", err);
        return res.status(500).json({
            // success: true, // Typo corrected
            success: false,
            message: "Failed to update college placement data",
            error: err.message
        });
    }
};
// Note: Add get/update/delete for individual placement records if needed via separate routes/controller