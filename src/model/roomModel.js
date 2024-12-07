// room data is designed not to be persistent

/**
 * Represents a game room where players take turns playing valid words.
 * The game follows a specific set of rules and has a time limit.
 *
 * @class GameRoom
 */

const fs = require("fs");
const path = require("path");

class GameRoom {
	/**
	 * Creates an instance of a game room.
	 *
	 * @param {string} creatorUsername - The username of the player who created the room.
	 * @param {string} roomId - Unique identifier for the game room.
	 * @param {string} creatorSocketId - The socket ID of the creator of the room.
	 */
	constructor(creatorUsername, roomId, creatorSocketId) {
		this.creatorUsername = creatorUsername;
		this.roomId = roomId;
		this.createdRoomTime = new Date();

		// Set room expiry time to 1 hour after creation
		this.roomExpiryTime = new Date(
			this.createdRoomTime.getTime() + 60 * 60 * 1000
		);

		// Set game end time to 30 minutes after creation
		this.gameEndTime = new Date(
			this.createdRoomTime.getTime() + 30 * 60 * 1000
		);

		// room and game states
		this.isRoomActive = true;
		this.isGameStarted = false;
		this.isGameEnded = false;

		// room configs
		this.maxPlayers = 4;
		this.playersMap = new Map([
			[creatorUsername, { socketId: creatorSocketId, points: 0 }],
		]);
		this.usedWordSet = new Set();

		// stores the last word that was used for comparison, will be replaced after each successful new word is used
		this.lastWord = null;

		// these are variables for keepting timeouts and intervals
		this.roomExpiryTimer = setTimeout(
			() => this.deleteRoom("Room expired"),
			60 * 60 * 1000
		); // 1 hour
		this.gameEndTimer = null;
		this.roundTimer = null;

		// winner array
		this.roomWinnerArray = null;

		// turn order properties
		this.currentTurn = creatorUsername; // creator always starts first
		this.turnOrder = []; // store users in current turn order
		this.currentTurnIndex = 0;

		// word list loading
		this.validWords = this.loadWordList();
	}

	/**
	 * Logs and broadcasts errors to the room.
	 *
	 * @param {Error} error - The error to handle.
	 * @param {string} context - The context in which the error occurred.
	 */
	handleError(error, context) {
		console.error(`Error in ${context}:`, error);

		// Broadcast error to the entire room
		this.broadcast("errorOccurred", {
			errorMessage: "An unexpected error occurred in the game",
			details: error.toString(),
		});

		// You could also log the error to an external service (e.g., Sentry, LogRocket)
	}

	/**
	 * Gets the socket ID of a player.
	 *
	 * @param {string} username - The username of the player.
	 * @returns {string|null} The socket ID of the player or null if not found.
	 */
	getUserSocket(username) {
		if (this.playersMap.has(username)) {
			return this.playersMap.get(username).socketId;
		}
		return null;
	}

	/**
	 * Sends a message to a specific player.
	 *
	 * @param {string} username - The username of the player.
	 * @param {string} event - The event to emit.
	 * @param {Object} [message] - The message to send with the event.
	 * @returns {boolean} True if the message was successfully sent, otherwise false.
	 */
	sendToPlayer(username, event, message) {
		const socketId = this.getUserSocket(username);

		if (!socketId) {
			const error = new Error(
				`No socket was found in the player map for player ${username}`
			);
			this.handleError(error, `sending message to ${username}`);
			return false;
		}

		try {
			if (!message) {
				io.to(socketId).emit(event);
			} else {
				io.to(socketId).emit(event, message);
			}
			return true;
		} catch (error) {
			this.handleError(error, `sending message to ${username}`);
			io.to(socketId).emit("redirectMainPage", {
				errorMessage:
					"There was an issue in the server runtime, redirecting...",
				details: error.toString(),
			});
			return false;
		}
	}

	/**
	 * Broadcasts a message to all players in the room.
	 *
	 * @param {string} event - The event to broadcast.
	 * @param {Object} [message] - The message to broadcast with the event.
	 * @returns {boolean} True if the message was successfully broadcasted, otherwise false.
	 */
	broadcast(event, message) {
		try {
			if (message) {
				io.to(this.roomId).emit(event, message);
			} else {
				io.to(this.roomId).emit(event);
			}
			return true;
		} catch (error) {
			// Broadcast an error to the entire room
			io.to(this.roomId).emit("errorOccurred", {
				originalEvent: event,
				errorMessage: "An unexpected broadcast error occurred",
				details: error.toString(),
			});
			this.handleError(error, `broadcasting event '${event}'`);
			return false;
		}
	}

	/**
	 * Adds a new player to the game room.
	 *
	 * @param {string} username - The username of the player to add.
	 * @param {string} socketId - The socket ID of the player to add.
	 * @returns {boolean} True if the player was successfully added, otherwise false.
	 */
	addPlayer(username, socketId) {
		if (this.playersMap.size >= this.maxPlayers) {
			const error = new Error("Room is full");
			this.handleError(error, `adding player ${username}`);
			return false;
		}

		if (this.playersMap.has(username)) {
			const error = new Error(`Player ${username} already exists`);
			this.handleError(error, `adding player ${username}`);
			return false;
		}

		try {
			this.playersMap.set(username, { socketId: socketId, points: 0 });
			return true;
		} catch (error) {
			this.handleError(error, `adding player ${username}`);
			return false;
		}
	}

	/**
	 * Removes a player from the game room.
	 *
	 * @param {string} username - The username of the player to remove.
	 * @returns {boolean} True if the player was successfully removed, otherwise false.
	 */
	removePlayer(username) {
		try {
			// Check if the player exists in the playersMap
			if (this.playersMap.has(username)) {
				// Remove the player from the playersMap
				this.playersMap.delete(username);

				// Remove the player from the turn order
				const playerIndex = this.turnOrder.indexOf(username);
				if (playerIndex !== -1) {
					this.turnOrder.splice(playerIndex, 1);
				}

				// If the player who is removed is the current turn player, we need to move to the next turn
				if (this.currentTurn === username) {
					// If there are still players in the game, move to the next player
					if (this.turnOrder.length > 0) {
						this.currentTurnIndex =
							(this.currentTurnIndex + 1) % this.turnOrder.length;
						this.currentTurn = this.turnOrder[this.currentTurnIndex];
					} else {
						// If no players are left, the game is effectively over
						this.endGame();
					}

					// Broadcast the change in turn order
					this.broadcast("turnChanged", { currentPlayer: this.currentTurn });
				}

				// Successfully removed player and updated turn order
				return true;
			}

			// Player does not exist in the map
			return false;
		} catch (error) {
			// Handle error
			this.handleError(error, `removing player ${username}`);
			return false;
		}
	}

	/**
	 * Checks if a word has already been used in the game.
	 *
	 * @param {string} word - The word to check.
	 * @returns {boolean} True if the word has already been used, otherwise false.
	 */
	isWordUsed(word) {
		return this.usedWordSet.has(word.toLowerCase());
	}

	/**
	 * Adds a word to the set of used words in the game.
	 *
	 * @param {string} word - The word to add to the set of used words.
	 */
	addUsedWords(word) {
		this.usedWordSet.add(word.toLowerCase());
		this.lastWord = word.toLowerCase();
	}

	/**
	 * Adds points to a player's score.
	 *
	 * @param {string} username - The username of the player to add points to.
	 * @param {number} points - The number of points to add.
	 * @returns {boolean} True if points were successfully added, otherwise false.
	 */
	addPoints(username, points) {
		const player = this.playersMap.get(username);
		if (player) {
			player.points += points;
			return true;
		}
		return false;
	}

	/**
	 * Initializes the turn order, ensuring that the creator goes first.
	 *
	 * @returns {void}
	 */
	initializeTurnOrder() {
		// ensure that the creator is first and that everyone'e elses turn is  random
		this.turnOrder = [
			this.creatorUsername,
			...Array.from(this.playersMap.keys())
				.filter((username) => username !== this.creatorUsername)
				.sort(() => Math.random() - 0.5),
		];

		this.currentTurnIndex = 0;
		this.currentTurn = this.turnOrder[0];
	}

	/**
	 * Checks if it's a player's turn.
	 *
	 * @param {string} username - The username of the player.
	 * @returns {boolean} True if it's the player's turn, otherwise false.
	 */
	isPlayerTurn(username) {
		return this.currentTurn === username;
	}

	/**
	 * Loads a list of valid words from a file.
	 *
	 * @returns {Set<string>} A set of valid words.
	 */
	loadWordList() {
		try {
			const wordListPath = path.join(__dirname, "words.txt");
			const wordList = fs
				.readFileSync(wordListPath, "utf8")
				.split("\n")
				.map((word) => word.toLowerCase().trim())
				.filter((word) => word.length > 0);

			return new Set(wordList);
		} catch (error) {
			// redirects all users to the main page and inform them of error
			this.handleError(error, "loading word list");

			return this.broadcast("redirectMainPage", {
				errorMessage:
					"There was an issue loading the word list, redirecting ...",
				details: error.toString(),
			});
		}
	}

	/**
	 * Checks if a word is valid by checking if it's in the word list.
	 *
	 * @param {string} word - The word to check.
	 * @returns {boolean} True if the word is valid, otherwise false.
	 */
	isValidWord(word) {
		return this.validWords.has(word.toLowerCase().trim());
	}

	/*******************
	 * GAME-PLAY CYCLE *
	 *******************/

	/**
	 * Moves the game to the next player's turn.
	 *
	 * @returns {string} The username of the new current player.
	 */
	nextTurn() {
		// turn Index management
		this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
		this.currentTurn = this.turnOrder[this.currentTurnIndex];

		// Boradcast turn change to all players
		this.broadcast("turnChanged", {
			currentPlayer: this.currentTurn,
		});

		return this.currentTurn;
	}

	/**
	 * Validates a player's word play.
	 *
	 * @param {string} username - The username of the player.
	 * @param {string} word - The word the player wants to play.
	 * @returns {Object} An object containing a `valid` boolean and a `reason` string.
	 */
	validateWordPlay(username, word) {
		try {
			// Check if it's the player's turn
			if (!this.isPlayerTurn(username)) {
				return {
					valid: false,
					reason: "Not your turn",
				};
			}

			// Validate word is in dictionary
			if (!this.isValidWord(word)) {
				return {
					valid: false,
					reason: "Not a valid word",
				};
			}

			// First word from creator can be anything
			if (!this.lastWord) {
				return {
					valid: true,
					reason: "First word",
				};
			}

			// Word must start with the last character of previous word
			const lastChar = this.lastWord.slice(-1).toLowerCase();
			const firstChar = word.charAt(0).toLowerCase();

			if (firstChar !== lastChar) {
				return {
					valid: false,
					reason: `Word must start with '${lastChar}'`,
				};
			}

			// Check if word has been used before
			if (this.usedWordSet.has(word.toLowerCase())) {
				return {
					valid: false,
					reason: "Word has been used before",
				};
			}

			return {
				valid: true,
				reason: "Valid word",
			};
		} catch (error) {
			this.handleError(error, `validating word play for ${username}`);
			return {
				valid: false,
				reason: "An unexpected error occurred during word validation",
			};
		}
	}

	/**
	 * Processes a player's word play. If valid, it adds points and proceeds to the next turn.
	 *
	 * @param {string} username - The username of the player playing the word.
	 * @param {string} word - The word the player wants to play.
	 * @returns {boolean} True if the word play was successful, otherwise false.
	 */
	playWord(username, word) {
		// validate the word
		const validation = this.validateWordPlay(username, word);

		if (!validation.valid) {
			// return failure to user
			this.sendToPlayer(username, "wordPlayFailed", {
				reason: validation.reason,
			});
			return false;
		}

		try {
			// Clear the round timer
			if (this.roundTimer) {
				clearTimeout(this.roundTimer);
			}

			// add points for successful word
			this.addPoints(username, word.length);

			// add word to used words
			this.addUsedWords(word);

			// Broadcast successful word play
			this.broadcast("wordPlayed", {
				username,
				word,
				points: word.length,
			});

			this.nextTurn();

			// Start the next round
			this.startRound();

			return true;
		} catch (error) {
			this.handleError(error, `processing word play for ${username}`);
			this.sendToPlayer(username, "wordPlayFailed", {
				reason: "An error occurred while processing your word",
			});
			return false;
		}
	}

	// // check if its a specific player's turn - duplicate
	// isPlayerTurn(username) {
	// 	return this.currentTurn === username;
	// }

	/**
	 * Starts the game, ensuring the minimum player count is met and initializing the game state.
	 *
	 * @returns {boolean} True if the game started successfully, otherwise false.
	 */
	startGame() {
		// returns false if the game has already started
		if (this.isGameStarted) return false;

		// ensure the minimum player count is met
		if (this.playersMap.size < 2) {
			this.broadcast("gameStartedFailed", {
				reason: "Not enough players",
			});
			return false;
		}

		// initialized turn order
		this.initializeTurnOrder();

		// set game states
		this.isGameStarted = true;
		this.isGameEnded = false;

		// game states - making sure there are what we expect them to be
		this.usedWordSet.clear();
		this.lastWord = null;

		// set up game end timer
		this.gameEndTimer = setTimeout(() => {
			this.endGame();
		}, 30 * 60 * 1000); // 30 mins

		// broadcast game start
		this.broadcast("gameStarted", {
			firstPlayer: this.currentTurn,
			players: this.turnOrder,
		});

		// Start the first round
		this.startRound();

		return true;
	}

	/**
	 * Starts a new round, setting up the timer for the current player's turn.
	 */
	startRound() {
		// Clear any existing round timer
		if (this.roundTimer) {
			clearTimeout(this.roundTimer);
		}

		// Set up a new 30-second timer for the current player's turn
		this.roundTimer = setTimeout(() => {
			this.handleRoundTimeout();
		}, 30 * 1000); // 30 seconds

		// Notify the current player that it's their turn
		this.sendToPlayer(this.currentTurn, "yourTurn", {
			timeRemaining: 30,
		});
	}

	/**
	 * Handles the timeout of a round when a player doesn't make a move in time.
	 */
	handleRoundTimeout() {
		// The current player gets 0 points for not making a move
		this.addPoints(this.currentTurn, 0);

		// Broadcast a timeout message
		this.broadcast("turnTimedOut", {
			player: this.currentTurn,
		});

		// Move to the next turn
		this.nextTurn();

		// Start a new round
		this.startRound();
	}

	/**
	 * Ends the game, determines the winner, and broadcasts the results.
	 *
	 * @returns {boolean} True if the game ended successfully, otherwise false.
	 */
	endGame() {
		// validate the word
		const validation = this.validateWordPlay(username, word);

		if (!validation.valid) {
			// return failure to user
			this.sendToPlayer(username, "wordPlayFailed", {
				reason: validation.reason,
			});
			return false;
		}

		try {
			// Clear the round timer
			if (this.roundTimer) {
				clearTimeout(this.roundTimer);
			}

			// add points for successful word
			this.addPoints(username, word.length);

			// add word to used words
			this.addUsedWords(word);

			// Broadcast successful word play
			this.broadcast("wordPlayed", {
				username,
				word,
				points: word.length,
			});

			this.nextTurn();

			// Start the next round
			this.startRound();

			return true;
		} catch (error) {
			this.handleError(error, `processing word play for ${username}`);
			this.sendToPlayer(username, "wordPlayFailed", {
				reason: "An error occurred while processing your word",
			});
			return false;
		}
	}

	/**
	 * Determines the winner of the game based on the highest points.
	 *
	 * @returns {Array<string>} An array of winner usernames (can be multiple if there's a tie).
	 */
	determineWinner() {
		let maxPoints = -1;
		let winners = [];

		// Iterate through each player to find the highest points and potential ties
		for (const [username, playerData] of this.playersMap) {
			if (playerData.points > maxPoints) {
				// Found a new higher score, reset the winners array
				winners = [username];
				maxPoints = playerData.points;
			} else if (playerData.points === maxPoints) {
				// If the points match the max, add to the winners array
				winners.push(username);
			}
		}

		// Return the array of winners (even if there's only one winner)
		return winners;
	}

	/**
	 * Deletes the room and notifies all players.
	 *
	 * @param {string} reason - The reason for deleting the room.
	 */
	deleteRoom(reason) {
		// Clear all timers
		this.clearGameTimers();
		if (this.roomExpiryTimer) {
			clearTimeout(this.roomExpiryTimer);
		}

		// Broadcast room deletion to all players
		this.broadcast("roomDeleted", { reason });

		// Here you would typically remove the room from any server-side storage
		// For example: rooms.delete(this.roomId);
	}

	/**
	 * Clears all active game timers.
	 *
	 * @returns {void}
	 */
	clearGameTimers() {
		if (this.gameEndTimer) {
			clearTimeout(this.gameEndTimer);
			this.gameEndTimer = null;
		}

		if (this.roundTimer) {
			clearTimeout(this.roundTimer);
			this.roundTimer = null;
		}

		if (this.roomExpiryTimer) {
			clearTimeout(this.roomExpiryTimer);
			this.roomExpiryTimer = null;
		}
	}
}

module.exports = GameRoom;
