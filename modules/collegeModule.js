const mongoose = require("mongoose")

const collegeSchema = new mongoose.Schema(
  {
    name:{
        type: String,
        required: true
    },
    location:{
        type: String,
    },
    year:{
        type: String,
    },
    affiliation:{
        type: String
    },
    type:{
        type: String
    },
    courses:[{
        type: String
    }],
    branches:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch"
    }],
    admissionProcess:{
        type: String
    },
    infrastructure:{
        type: String
    },
    placement:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "placement"
    },
    review:{
        type: String, //todo: need to change in a object later
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("college", collegeSchema)
