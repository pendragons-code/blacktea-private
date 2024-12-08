const pool = require("../services/mysql-service.js");

module.exports = {
	// Create a new user with gamesPlayed and gamesWon columns initialized to 0
	createUser(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `	
        INSERT INTO Users (username, email, password, dateOfCreation, gamesPlayed, gamesWon)
        VALUES (?, ?, ?, NOW(), 0, 0);
      `;

			const values = [data.username, data.email, data.password];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	},

	// Get user by ID, including gamesPlayed and gamesWon
	getUserById(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
        SELECT username, dateOfCreation, gamesPlayed, gamesWon FROM Users
        WHERE id = ?;
      `;

			const values = [data.id];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				if (results.length === 0) return reject(new Error("User not found"));
				resolve(results[0]);
			});
		});
	},

	// Get user by username, including gamesPlayed and gamesWon
	getUserByUsername(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
			SELECT id, username, email, dateOfCreation, gamesPlayed, gamesWon, password FROM Users
			WHERE username = ?;
		  `;
			const values = [data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results.length ? results[0] : null); // Return null if no user found
			});
		});
	},

	// Get the number of games played and won by username
	getUserStatsByUsername(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
        SELECT gamesPlayed, gamesWon FROM Users
        WHERE username = ?;
      `;

			const values = [data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				if (results.length === 0) return reject(new Error("User not found"));
				resolve(results[0]);
			});
		});
	},

	// Get user by username with password (including gamesPlayed and gamesWon)
	getUserByUsernameWithPassword(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
        SELECT id, dateOfCreation, gamesPlayed, gamesWon, password FROM Users
        WHERE username = ?;
      `;

			const values = [data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				if (results.length === 0) return reject(new Error("User not found"));
				resolve(results[0]);
			});
		});
	},

	// Get user by email
	getUserByEmail(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
			SELECT id, username, email, dateOfCreation, gamesPlayed, gamesWon, password FROM Users
			WHERE email = ?;
		  `;
			const values = [data.email];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results.length ? results[0] : null); // Return null if no user found
			});
		});
	}
	,

	// Update the number of games played and won for a specific user
	updateUserStatsByUserName(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
        UPDATE Users
        SET gamesPlayed = ?, gamesWon = ?
        WHERE username = ?;
      `;

			const values = [data.gamesPlayed, data.gamesWon, data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	},

	// Delete a user by username
	deleteUserByUsername(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
        DELETE FROM Users
        WHERE username = ?;
      `;

			const values = [data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	}
};
