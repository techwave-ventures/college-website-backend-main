const mongoose = require("mongoose")

const placementSchema = new mongoose.Schema(
  {
    average:{
        type: String,
    },
    highest:{
        type: String,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model("placement", placementSchema)
