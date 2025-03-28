const mongoose = require("mongoose")

const criteriaSchema = new mongoose.Schema(
  {
    cast:{
        type: String,
    },
    mark:{
        type: String,
    },
    rank:{
        type:String
    }
    },
  { timestamps: true }
)

module.exports = mongoose.model("criteria", criteriaSchema)
