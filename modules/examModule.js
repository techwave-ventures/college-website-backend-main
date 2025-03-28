const mongoose = require("mongoose")

const examSchema = new mongoose.Schema(
  {
    name:{
        type: String,
    },
    colleges: [{
        type: mongoose.Schema.Types.ObjectId,
        default: [],
        ref: "college"
    }]
    },
  { timestamps: true }
)

module.exports = mongoose.model("exam", examSchema)
