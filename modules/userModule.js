const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    name:{
        type: String,
        required: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    accountType: {
      type: String,
      enum: ["Student"],
      required: true,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model("user", userSchema)
