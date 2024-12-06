require("dotenv").config();

const mysql = require("mysql2");

const setting = {
	connectionLimit: 10, //set limit to 10 connection
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
	port: process.env.DB_PORT,
	multipleStatements: true, //allow multiple sql statements
	dateStrings: true //return date as string instead of Date object
}

const pool = mysql.createPool(setting);

module.exports = pool;