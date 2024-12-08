const GameRoom = require("../model/roomModel"); // Adjust path as needed
const userModel = require("../model/userModel");

// Store active rooms
const rooms = new Map();

const socketEvents = {
	/**
	 * Handle creating a new game room
	 * @param {Socket} socket - The socket of the room creator
	 * @param {Object} data - Room creation data
	 */
	createRoom: (socket, data) => {
		try {
			const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`; // substr is deprecated
			const username = socket.userData.username;

			// Create a new game room
			const newRoom = new GameRoom(username, roomId, socket.id);
			rooms.set(roomId, newRoom);

			// Join the room
			socket.join(roomId);

			// Respond to the creator
			socket.emit("roomCreated", {
				roomId: roomId,
				message: "Room created successfully"
			});
		} catch (error) {
			socket.emit("errorOccurred", {
				message: "Failed to create room",
				error: error.toString()
			});
		}
	},

	/**
	 * Handle joining an existing game room
	 * @param {Socket} socket - The socket of the player joining
	 * @param {Object} data - Room joining data
	 */
	joinRoom: (socket, data) => {
		try {
			const { roomId } = data;
			const username = socket.userData.username;

			// Check if room exists
			const room = rooms.get(roomId);
			if (!room) {
				return socket.emit("errorOccurred", {
					message: "Room does not exist"
				});
			}

			// Try to add player to the room
			const playerAdded = room.addPlayer(username, socket.id);
			if (!playerAdded) {
				return socket.emit("errorOccurred", {
					message: "Failed to join room"
				});
			}

			// Join the room
			socket.join(roomId);

			// Broadcast to other players in the room
			io.to(roomId).emit("playerJoined", {
				username: username,
				message: `${username} has joined the room`
			});

			// Inform the joining player about room details
			socket.emit("roomJoined", {
				roomId: roomId,
				players: Array.from(room.playersMap.keys())
			});
		} catch (error) {
			socket.emit("errorOccurred", {
				message: "Error joining room",
				error: error.toString()
			});
		}
	},

	/**
	 * Handle starting the game
	 * @param {Socket} socket - The socket of the player starting the game
	 * @param {Object} data - Game start data
	 */
	startGame: (socket, data) => {
		try {
			const { roomId } = data;
			const room = rooms.get(roomId);

			if (!room) {
				return socket.emit("errorOccurred", {
					message: "Room not found"
				});
			}

			// Attempt to start the game
			const gameStarted = room.startGame();
			if (!gameStarted) {
				return socket.emit("errorOccurred", {
					message: "Failed to start game"
				});
			}
		} catch (error) {
			socket.emit("errorOccurred", {
				message: "Error starting game",
				error: error.toString()
			});
		}
	},

	/**
	 * Handle player word submission
	 * @param {Socket} socket - The socket of the player submitting the word
	 * @param {Object} data - Word submission data
	 */
	submitWord: (socket, data) => {
		try {
			const { roomId, word } = data;
			const username = socket.userData.username;
			const room = rooms.get(roomId);

			if (!room) {
				return socket.emit("errorOccurred", {
					message: "Room not found"
				});
			}

			// Attempt to play the word
			const wordPlayed = room.playWord(username, word);
			if (!wordPlayed) {
				// Word play failed (reason will be sent by room.playWord)
				return;
			}
		} catch (error) {
			socket.emit("errorOccurred", {
				message: "Error submitting word",
				error: error.toString()
			});
		}
	},

	/**
	 * Handle player leaving the room
	 * @param {Socket} socket - The socket of the player leaving
	 * @param {Object} data - Room leaving data
	 */
	leaveRoom: (socket, data) => {
		try {
			const { roomId } = data;
			const username = socket.userData.username;
			const room = rooms.get(roomId);

			if (!room) {
				return socket.emit("errorOccurred", {
					message: "Room not found"
				});
			}

			// Remove player from the room
			const playerRemoved = room.removePlayer(username);
			if (!playerRemoved) {
				return socket.emit("errorOccurred", {
					message: "Failed to leave room"
				});
			}

			// Leave the socket room
			socket.leave(roomId);

			// Broadcast to remaining players
			io.to(roomId).emit("playerLeft", {
				username: username,
				message: `${username} has left the room`
			});

			// If no players left, delete the room
			if (room.playersMap.size === 0) {
				rooms.delete(roomId);
			}
		} catch (error) {
			socket.emit("errorOccurred", {
				message: "Error leaving room",
				error: error.toString()
			});
		}
	},

	/**
	 * Handle game end and winner determination
	 * @param {Socket} socket - The socket of the player ending the game
	 * @param {Object} data - Game end data
	 */
	endGame: async (socket, data) => {
		try {
			const { roomId } = data;
			const room = rooms.get(roomId);

			if (!room) {
				return socket.emit("errorOccurred", {
					message: "Room not found"
				});
			}

			// Determine winners
			const winners = room.determineWinner();

			// Update user statistics
			for (const winner of winners) {
				try {
					// Fetch current user stats
					const userStats = await userModel.getUserStatsByUsername({ username: winner });

					// Update games played and won
					await userModel.updateUserStatsByUserName({
						username: winner,
						gamesPlayed: userStats.gamesPlayed + 1,
						gamesWon: userStats.gamesWon + 1
					});
				} catch (statsError) {
					console.error(`Error updating stats for ${winner}:`, statsError);
				}
			}

			// Broadcast game results
			io.to(roomId).emit("gameEnded", {
				winners: winners,
				playerScores: Object.fromEntries(room.playersMap)
			});

			// Delete the room
			rooms.delete(roomId);
		} catch (error) {
			socket.emit("errorOccurred", {
				message: "Error ending game",
				error: error.toString()
			});
		}
	}

}

module.exports = socketEvents;