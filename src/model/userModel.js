const pool = require("../services/mysql-service.js");

module.exports = {
	createUser(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
            INSERT INTO Users (username, email, password, dateOfCreation, highestScore)
            VALUES (?, ?, ?, NOW(), 0);
            `;

			const values = [data.username, data.email, data.password];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	},

	getUserById(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
            SELECT username, dateOfCreation, highestScore FROM Users
            WHERE id = ?;
            `;

			const values = [data.id];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	},

	getUserByUsername(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
            SELECT id, dateOfCreation, highestScore FROM Users
            WHERE username = ?;
            `;

			const values = [data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	},

	getUserHighScoreByUsername(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
            SELECT highestScore FROM Users
            WHERE username = ?;
            `;

			const values = [data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	},

	getUserByUsernameWithPassword(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
            SELECT id, dateOfCreation, highestScore, password FROM Users
            WHERE username = ?;
            `;

			const values = [data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	},

	updateUserHighestScoreByUserName(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
            UPDATE Users
            SET highestScore = ?
            WHERE username = ?
            `;

			const values = [data.newHighScore, data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	},

	deleteUserByUsername(data) {
		return new Promise((resolve, reject) => {
			const sqlStatement = `
            DELETE FROM Users
            WHERE username = ?
            `;

			const values = [data.username];

			pool.query(sqlStatement, values, (error, results) => {
				if (error) return reject(error);
				resolve(results);
			});
		});
	}
};