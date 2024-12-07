const io = require("socket.io")(server); // Assuming `server` is your HTTP server
const jwt = require("jsonwebtoken");
const jwtSecretKey = process.env.JWT_SECRET_KEY;

// Middleware to validate JWT token for socket connections
io.use((socket, next) => {
	// Extract token from Authorization header or query params
	const token = socket.handshake.headers["authorization"]?.split(" ")[1] || socket.handshake.query.token;

	if (!token) {
		return next(new Error("Authentication error: No token provided"));
	}

	// Verify the token using jwt.verify
	jwt.verify(token, jwtSecretKey, (err, decoded) => {
		if (err) {
			return next(new Error("Authentication error: Invalid token"));
		}

		// Attach the decoded user data to the socket for later use
		socket.userData = decoded;
		next(); // Proceed with the connection
	});
});

// When a client successfully connects, you can access socket.userData
io.on("connection", (socket) => {
	console.log(`User connected: ${socket.id}`);
	console.log("User data:", socket.userData); // The decoded JWT payload

	// Handle specific socket events
	socket.on("message", (data) => {
		console.log(data);
	});

	// Handle disconnection
	socket.on("disconnect", () => {
		console.log(`User disconnected: ${socket.id}`);
	});
});
