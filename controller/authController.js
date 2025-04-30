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
      const { email, password } = req.body;

      if (!email || !password) {
          return res.status(400).json({
              success: false,
              message: `Please Fill up All the Required Fields`,
          });
      }

      const user = await User.findOne({ email }); //.select("+password"); // Select password if not selected by default

      if (!user) {
          return res.status(401).json({
              success: false,
              message: `User is not Registered with Us Please SignUp to Continue`,
          });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
          // *** CHANGE: Generate JWT Payload ***
          const payload = {
              email: user.email,
              id: user._id, // Use '_id' from Mongoose
              accountType: user.accountType, // Include role/accountType needed by middleware
          };

          // *** CHANGE: Generate JWT ***
          // Use JWT_SECRET consistently (make sure .env uses JWT_SECRET or API_SECRET consistently)
          const token = jwt.sign(payload, process.env.API_SECRET, { // Use consistent env var name
              expiresIn: "24h", // Or your desired expiry (e.g., '1h')
          });

          // Prepare user object to send back (remove password)
          const userResponse = user.toObject(); // Convert Mongoose doc to plain object if needed
          delete userResponse.password;

          // *** CHANGE: Set HTTP-Only Cookie ***
          const cookieOptions = {
              expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // Matches token expiry (24 hours)
              httpOnly: true, // Cannot be accessed by client-side JS
              secure: true, // Send only over HTTPS in production
              sameSite: 'none', // Helps prevent CSRF. 'strict' is more secure but can break some cross-site linking. 'lax' is usually a good default.
              // path: '/', // Make cookie available for all paths on the domain
              // domain: 'yourdomain.com' // Uncomment and set if needed for subdomains in production
              // signed: true // Uncomment if you are using signed cookies (requires COOKIE_SECRET in cookieParser)
          };

          console.log("[Login Controller] Attempting to set cookie...");
          console.log("[Login Controller] Token generated:", token ? "Yes (length: " + token.length + ")" : "No");
          console.log("[Login Controller] Cookie Options:", JSON.stringify(cookieOptions, null, 2)); // Pretty print options

           // Use a consistent cookie name, e.g., 'authToken'
          res.cookie('authToken', token, cookieOptions);

          console.log("[Login Controller] res.cookie('authToken', ...) executed.");

          // *** CHANGE: Send success response WITHOUT the token in the body ***
          res.status(200).json({
              success: true,
              user: userResponse, // Send user details (without password)
              message: `User Login Success`,
          });

      } else {
          return res.status(401).json({
              success: false,
              message: `Password is incorrect`,
          });
      }
  } catch (error) {
      console.error("Login Error:", error);
      return res.status(500).json({
          success: false,
          message: `Login Failure Please Try Again`,
      });
  }
};

// *** ADD: Logout Controller ***
exports.logout = (req, res) => {
   console.log("[Logout Controller] Attempting to clear authToken cookie...");
   try {
       // Clear the cookie by setting its expiration date to the past
       const cookieOptions = {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          expires: new Date(0), // Set expiry date to the past
          // path: '/', // IMPORTANT: Must match the options used when setting the cookie
          // domain: 'yourdomain.com' // IMPORTANT: Must match the options used when setting the cookie
          // signed: true // IMPORTANT: Must match the options used when setting the cookie
      };
       // Ensure cookie name matches the one used in login ('authToken')
       res.cookie('authToken', '', cookieOptions); // Setting value to empty string is also common

      // Or using clearCookie (might be simpler if options match exactly)
      // res.clearCookie('authToken', {
      //     httpOnly: true,
      //     secure: process.env.NODE_ENV === 'production',
      //     sameSite: 'lax',
      //     path: '/',
      //     // domain: 'yourdomain.com'
      // });

      console.log("[Logout Controller] authToken cookie cleared.");
      res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
      console.error("[Logout Controller] Error clearing cookie:", error);
       // Even if clearing fails on server (unlikely), still send success as client state should reset
       res.status(500).json({ success: false, message: "Logout failed on server." });
  }
};


// *** ADD: Controller for /auth/me endpoint ***
exports.checkAuthStatus = async (req, res) => {
  // This controller only runs if the 'auth' middleware before it was successful
  // The 'auth' middleware attaches req.user
   console.log("[checkAuthStatus] User is authenticated:", req.user?.email);
  res.status(200).json({ isAuthenticated: true, user: req.user });
};