const mongoose = require("mongoose")

const branchSchema = new mongoose.Schema(
  {
    name:{
        type: String,
    },
    criteria:[{
        type: mongoose.Schema.Types.ObjectId,
        default: [],
        ref: "criteria"
    }],
    fees:{
        type: String
    }
    },
  { timestamps: true }
)

module.exports = mongoose.model("Branch", branchSchema)
