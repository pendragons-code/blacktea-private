require("dotenv").config();
const jwt = require("jsonwebtoken");
const jwtSecretKey = process.env.JWT_SECRET_KEY;

// This is the middleware function to validate the JWT
module.exports.validateTokenMiddleWare = async (req, res, next) => {
	let token = null;

	// Try to get the token from the Authorization header (Bearer <token>)
	const authHeader = req.headers["authorization"];
	if (authHeader && authHeader.startsWith("Bearer ")) {
		token = authHeader.split(" ")[1];
	}

	// If no token found in Authorization header, fallback to cookies
	if (!token && req.cookies && req.cookies.token) {
		token = req.cookies.token; // If present, get the token from cookies
	}

	// If there's still no token, redirect the user or send a response
	if (!token) {
		return res.redirect("/landing"); // or return a 401 status if you prefer
	}

	try {
		// Verify the JWT with the secret key
		const decoded = jwt.verify(token, jwtSecretKey);
		req.userData = decoded; // Attach the decoded user data to the request object
		next(); // Proceed to the next middleware or route handler
	} catch (err) {
		console.error("Token validation error:", err);
		if (err.name === "JsonWebTokenError") {
			return res.status(401).json({ message: "Invalid or expired token." });
		}
		return res.status(500).json({ message: "Internal Server Error" }); // Handle any other errors
	}
};


module.exports.functionValidateTokenAndReroute = async (req, res, route) => {
	if(route == "signup") return res.render("signup");

	let token = null;

	// Try to get the token from the Authorization header (Bearer <token>)
	const authHeader = req.headers["authorization"];
	if (authHeader && authHeader.startsWith("Bearer ")) {
		token = authHeader.split(" ")[1];
	}

	// If no token found in Authorization header, fallback to cookies
	if (!token && req.cookies && req.cookies.token) {
		token = req.cookies.token;
	}

	// If there's no token, redirect to login or the desired route
	if (!token) {
		return res.redirect("/landing");
	}

	try {
		// Verify the JWT with the secret key
		jwt.verify(token, jwtSecretKey, (err, decoded) => {
			if (err) {
				console.error("Token verification error:", err);
				return res.render(route); // Render the fallback route in case of error
			}

			// Attach the decoded token data to req.userData
			req.userData = decoded;
			// Redirect or continue with the request processing
			return res.redirect("/");
		});
	} catch (e) {
		console.error("Middleware error", e);
		// If an error occurs, send a response or render a fallback route
		res.status(500).json({ msg: "Server Error" });
	}
}