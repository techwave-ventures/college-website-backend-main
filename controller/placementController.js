const placementModule = require("../modules/placementModule")
const collegeModule = require("../modules/collegeModule")

exports.createPlacement = async(req,res) =>{
    try{

        const {average,highest} = req.body;
        const {collegeId} = req.params;

        const createdPlacement = await placementModule.create({
            average:average,
            highest:highest
        });

        //add branch into college
        const updatedcollege = await collegeModule.findById(collegeId);
        updatedcollege.placement = createdPlacement;
        updatedcollege.save();

        return res.status(201).json({
            success:true,
            message:"Placement created successfully",
            body:createdPlacement,
            college:updatedcollege
        })

    } catch(err) {
        return res.status(500).json({
            success:true,
            message:err.message
        })
    }
}

