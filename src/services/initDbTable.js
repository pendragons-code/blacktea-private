const pool = require("../services/db.js");

const SQLSTATEMENT = `
DROP TABLE IF EXISTS Users;
-- Create the Users table with sensible limits for username length

CREATE TABLE Users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(20) NOT NULL,  -- Maximum of 20 characters for username
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  dateOfCreation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Defaults to current time
  gamesPlayed INT DEFAULT 0,
  gamesWon INT DEFAULT 0,
  CONSTRAINT username_length CHECK (LENGTH(username) BETWEEN 3 AND 20),  -- Ensure username is between 3 and 20 characters
  CONSTRAINT email_unique UNIQUE (email)  -- Enforce uniqueness of email addresses

`;

pool.query(SQLSTATEMENT, (error, results, fields) => {
	if (error) {
		console.error("Error creating tables:", error);
	} else {
		console.log("Tables created successfully:", results);
	}
	process.exit();
});