const branchModule = require("../modules/branchModule")
const collegeModule = require("../modules/collegeModule")

exports.createBranch = async(req,res) =>{
    try{

        const {name, fees} = req.body;
        const {collegeId} = req.params;

        const createdBranch = await branchModule.create({
            name:name,
            fees: fees
        });

        //add branch into college
        const updatedcollege = await collegeModule.updateOne({ _id: collegeId }, { $push: { branches: createdBranch} });

        return res.status(201).json({
            success:true,
            message:"Branch created successfully",
            body:createdBranch,
            college:updatedcollege
        })

    } catch(err) {
        return res.status(500).json({
            success:true,
            message:err.message
        })
    }
}

