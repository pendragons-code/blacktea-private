const { body, validationResult } = require("express-validator");
const authorizationFunctions = require("./authorization.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../model/userModel.js");

// User Signup
module.exports.userSignup = [
	// Validation Middleware
	body("username")
		.notEmpty().withMessage("Username is required.")
		.isLength({ min: 3 }).withMessage("Username must be at least 3 characters long."),

	body("email")
		.notEmpty().withMessage("Email is required.")
		.isEmail().withMessage("Email is not valid.")
		.normalizeEmail(),

	body("password")
		.notEmpty().withMessage("Password is required.")
		.isLength({ min: 6 }).withMessage("Password must be at least 6 characters long.")
		.matches(/\d/).withMessage("Password must contain at least one number.")
		.matches(/[a-zA-Z]/).withMessage("Password must contain at least one letter."),

	// Controller Logic
	async (req, res, next) => {
		// Check for validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { username, email, password } = req.body;

		try {
			// Check if user already exists by username or email
			const existingUserByUsername = await userModel.getUserByUsername({ username });
			if (existingUserByUsername) {
				return res.status(400).json({ message: "Username already taken." });
			}

			const existingUserByEmail = await userModel.getUserByEmail({ email });
			if (existingUserByEmail) {
				return res.status(400).json({ message: "Email already in use." });
			}

			// Hash the Password
			const hashedPassword = await bcrypt.hash(password, 10);  // 10 is the salt rounds

			// Create the User
			const userData = {
				username,
				email,
				password: hashedPassword,
			};

			const result = await userModel.createUser(userData);

			// Send Success Response
			res.status(201).json({
				message: "User successfully created.",
				userId: result.insertId,
				username,
			});
		} catch (error) {
			console.error("Error during signup:", error);
			next(error);
		}
	}
];

// User Login
module.exports.userLogin = [
	// Validation Middleware
	body("username")
		.notEmpty().withMessage("Username is required."),

	body("password")
		.notEmpty().withMessage("Password is required."),

	// Controller Logic
	async (req, res, next) => {
		// Check for validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { username, password } = req.body;

		try {
			// Check if the user exists by username
			const user = await userModel.getUserByUsernameWithPassword({ username });
			if (!user) {
				return res.status(401).json({ message: "Invalid credentials." });
			}

			// Compare Passwords
			const isPasswordValid = await bcrypt.compare(password, user.password);
			if (!isPasswordValid) {
				return res.status(401).json({ message: "Invalid credentials." });
			}

			// Create JWT Token
			const payload = {
				userId: user.id,
				username: user.username,
			};
			const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: "1h" });

			// Return Token
			res.status(200).json({
				message: "Login successful.",
				token,  // the token can now be used for subsequent requests
			});
		} catch (error) {
			console.error("Error during login:", error);
			next(error);  // Pass error to the error handling middleware
		}
	}
];

module.exports.userLogOut = (req, res, next) => {
	// TODO: token blacklisting

	// Clear the token cookie
	res.clearCookie("token", {
		path: "/",
		httpOnly: true,
		// secure: true,
		sameSite: "strict"
	});

	// Send a successful logout response
	res.status(200).json({ message: "Logged out successfully" });
}

module.exports.renderHomePage = (req, res, next) => {
	return res.render("play.ejs");
}

module.exports.renderLandingPage = (req, res, next) => {
	return res.render("landing.ejs");
}

module.exports.logIn = (req, res, next) => {
	authorizationFunctions.functionValidateTokenAndReroute(req, res, "login");
}
module.exports.signUp = (req, res, next) => {
	authorizationFunctions.functionValidateTokenAndReroute(req, res, "signup");
}