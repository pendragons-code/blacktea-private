const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const http = require("http");
const socketio = require("socket.io");
const expressStaticGzip = require("express-static-gzip");

// env
require("dotenv").config();
const PORT = process.env.PORT || 3000;

// socketIO
const app = express();
const server = http.createServer(app);
global.io = socketio(server);
require("./src/controller/socketController.js");


// express middlewares
app.set("view engine", "ejs");
app.set("views", path.resolve("./client/views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
	session({
		secret: process.env.SESSION_KEY,
		resave: false,
		saveUninitialized: true,
		cookie: {
			maxAge: 6000,
			httpOnly: true,
			// secure: true,
			sameSite: "none" // enable secure cookies on HTTPS only
		}
	})
);


// express routes and "CDN"
app.use("/", require("./src/routes/mainRoutes.js"));

app.use("/", expressStaticGzip(path.join(__dirname, "./client/public"), { //OMG i love this so much
	enableBrotli: true,
	orderPreference: ["br", "gzip"],
	cacheControl: true,
	immutable: true,
	maxAge: "30d"
}));

app.use(function (req, res) {
	res.status(404).render("404.ejs");
});


// webserver port
server.listen(PORT, (error) => {
	console.log(`App is on http://localhost:${PORT}`);
	if (error) return console.error(error);
});