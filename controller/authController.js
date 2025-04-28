const bcrypt = require("bcrypt")
const User = require("../modules/userModule") // Adjust path if necessary
const jwt = require("jsonwebtoken") // Needed for login
require("dotenv").config()


exports.signup = async (req, res) => {
  try {
    // Destructure fields from the request body
    const {
      name,
      email,
      phoneNumber,
      password,
      confirmPassword, // Still need this from body for comparison
      accountType,
    } = req.body

    // Check if necessary fields for account creation are present
    // REMOVED confirmPassword from this initial check, as frontend doesn't send it in signupData after comparison
    // It IS checked below for matching passwords.
    if (
      !name ||
      !email ||
      !phoneNumber ||
      !password
      // !accountType // Only if accountType is strictly required and has no default
    ) {
      return res.status(400).json({
        success: false,
        // Make sure message reflects what is actually checked now
        message: "Name, email, phone number, and password are required fields.",
      })
    }

    // Check if password and confirm password were provided and match
    // This check now implicitly handles if confirmPassword was missing from the request body
    if (!confirmPassword || password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Password and Confirm Password do not match or are missing. Please try again.",
      })
    }

    // Check if user already exists by email OR phone number
    const existingUserByEmail = await User.findOne({ email })
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists. Please sign in.",
      })
    }

    const existingUserByPhone = await User.findOne({ phoneNumber })
    if (existingUserByPhone) {
        return res.status(400).json({
            success: false,
            message: "User with this phone number already exists.",
        })
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create the user entry in the database
    const user = await User.create({
      name,
      email,
      phoneNumber,
      password: hashedPassword,
      accountType: accountType || "Student", // Use provided or default
    })

    // Don't send the password back
    user.password = undefined;

    return res.status(201).json({ // 201 Created
      success: true,
      user,
      message: "User registered successfully",
    })
  } catch (error) {
    console.error("Signup Error:", error)
    if (error.name === 'ValidationError') {
         return res.status(400).json({
            success: false,
            message: "Validation failed. Please check your input.",
            errors: error.errors
         });
    }
    return res.status(500).json({
      success: false,
      message: "User cannot be registered due to a server error. Please try again later.",
    })
  }
}

// Login controller (ensure JWT payload includes necessary fields for middleware)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: `Please Fill up All the Required Fields`,
      })
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: `User is not Registered with Us Please SignUp to Continue`,
      })
    }

    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign(
        // Payload for JWT - ensure it matches middleware expectations
        { email: user.email, id: user._id, accountType: user.accountType },
        process.env.API_SECRET,
        { expiresIn: "24h" }
      )

      user.password = undefined // Don't send password back

      // Send token in response body for the frontend API route to handle cookie setting
      res.status(200).json({
        success: true,
        token,
        user,
        message: `User Login Success`,
      })

    } else {
      return res.status(401).json({
        success: false,
        message: `Password is incorrect`,
      })
    }
  } catch (error) {
    console.error("Login Error:", error)
    return res.status(500).json({
      success: false,
      message: `Login Failure Please Try Again`,
    })
  }
}