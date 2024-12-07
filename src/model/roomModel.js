// room data is designed not to be persistent
const fs = require("fs");
const path = require("path");

class GameRoom {
	constructor(creatorUsername, roomId, creatorSocketId) {
		this.creatorUsername = creatorUsername;
		this.roomId = roomId;
		this.createdRoomTime = new Date();

		// Set room expiry time to 1 hour after creation
		this.roomExpiryTime = new Date(this.createdRoomTime.getTime() + 60 * 60 * 1000);

		// Set game end time to 30 minutes after creation
		this.gameEndTime = new Date(this.createdRoomTime.getTime() + 30 * 60 * 1000);

		// room and game states
		this.isRoomActive = true;
		this.isGameStarted = false;
		this.isGameEnded = false;

		// room configs
		this.maxPlayers = 4;
		this.playersMap = new Map([
			[creatorUsername, { socketId: creatorSocketId, points: 0 }]
		]);
		this.usedWordSet = new Set();

		// stores the last word that was used for comparison, will be replaced after each successful new word is used
		this.lastWord = null;

		// these are variables for keepting timeouts and intervals
		this.countDownToGameEnd = null;
		this.countDownPerRound = null;
		this.roomWinner = null;

		// turn order properties
		this.currentTurn = creatorUsername; // creator always starts first
		this.turnOrder = []; // store users in current turn order
		this.currentTurnIndex = 0;

		// word list loading
		this.validWords = this.loadWordList();
	}



	// get user socket
	getUserSocket(username) {
		if (this.playersMap.has(username)) {
			return this.playersMap.get(username).socketId;
		}
		return null;
	}



	// send to player
	sendToPlayer(username, event, message) {
		const socketId = this.getUserSocket(username);

		if (!socketId) {
			console.error(`No socket was found in the player map for player ${username}`);
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
			io.to(socketId).emit("redirectMainPage");
			console.error("Error in send to player", error);
			return false;
		}
	}




	// broadcast
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
				details: error.toString()
			});

			console.error("Error in broadcast", error);
			return false;
		}
	}




	// addPlayer
	addPlayer(username, socketId) {
		if (this.playersMap.size >= this.maxPlayers) return false;
		if (this.playersMap.has(usernme)) return false;
		this.playersMap.set(username, { socketId: socketId, points: 0 });
		return true;
	}




	// remove player
	removePlayer(username, socketId) {
		if (this.playersMap.has(username)) {
			this.playersMap.delete(username);
			return true;
		}
		return false;
	}



	// check if word used
	isWordUsed(word) {
		return this.usedWordSet.has(word.toLowerCase());
	}



	// add used words
	addUsedWords(word) {
		this.usedWordSet.add(word.toLowerCase());
		this.lastWord = word.toLowerCase();
	}



	// add points
	addPoints(username, points) {
		const player = this.playersMap.get(username);
		if (player) {
			player.points += points;
			return true;
		}
		return false;
	}



	// init turn order
	initializeTurnOrder() {
		// ensure that the creator is first and that everyone'e elses turn is  random
		this.turnOrder = [
			this.creatorUsername,
			...Array.from(this.playersMap.keys())
				.filter(username => username !== this.creatorUsername)
				.sort(() => Math.random() - 0.5)
		];

		this.currentTurnIndex = 0;
		this.currentTurn = this.turnOrder[0];
	}



	// check if user's turn
	isPlayerTurn(username) {
		return this.currentTurn === username;
	}



	// load word list
	loadWordList() {
		try {
			const wordListPath = path.join(__dirname, "words.txt");
			const wordList = fs.readFileSync(wordListPath, "utf8")
				.split("\n")
				.map(word => word.toLowerCase().trim())
				.filter(word => word.length > 0);

			return new Set(wordList);
		} catch (error) {
			console.error("Failed to load word list:", error);

			// Broadcast the error
			this.broadcast("errorOccurred", {
				errorMessage: "An unexpected wordlist initialization error occurred",
				details: error.toString()
			});

			// Return a fallback empty set or small default list
			return new Set(["default"]);
		}
	}



	// Method to check if the word is valid
	isValidWord(word) {
		return this.validWord.has(word.toLowerCase().trim());
	}



	/*******************
	 * GAME LIFE CYCLE *
	 *******************/


	// move to the next turn
	nextTurn() {
		// turn Index management
		this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
		this.currentTurn = this.turnOrder[this.currentTurnIndex];

		// Boradcast turn change to all players
		this.broadcast("turnChanged", {
			currentPlayer: this.currentTurn
		});

		return this.currentTurn;
	}



	// validate word play
	validateWordPlay(username, word) {
		// Check if it's the player's turn
		if (!this.isPlayerTurn(username)) {
			return {
				valid: false,
				reason: "Not your turn"
			};
		}

		// Validate word is in dictionary
		if (!this.isValidWord(word)) {
			return {
				valid: false,
				reason: "Not a valid word"
			};
		}

		// First word from creator can be anything
		if (!this.lastWord) {
			return {
				valid: true,
				reason: "First word"
			};
		}

		// Word must start with the last character of previous word
		const lastChar = this.lastWord.slice(-1).toLowerCase();
		const firstChar = word.charAt(0).toLowerCase();

		if (firstChar !== lastChar) {
			return {
				valid: false,
				reason: `Word must start with '${lastChar}'`
			};
		}

		// Check if word has been used before
		if (this.usedWordSet.has(word.toLowerCase())) {
			return {
				valid: false,
				reason: "Word has been used before"
			};
		}

		return {
			valid: true,
			reason: "Valid word"
		};

	}



	// play a word
	playWord(username, word) {
		// validate the word
		const validation = this.validateWordPlay(username, word);

		if (!validation.valid) {
			// return failure to user
			this.sendToPlayer(username, "wordPlayFailed", {
				reason: validation.reason
			});
			return false;
		}

		// add points for successful word
		this.addPoints(username, word.length);

		// add word to used words
		this.usedWordSet.add(word.toLowerCase());
		this.lastWord = word.toLowerCase();

		// Broadcst successful word play
		this.broadcast("wordPlayed", {
			username,
			word,
			points: word.length
		});

		this.nextTurn();
		return true;
	}



	// check if its a specific player's turn
	isPlayerTurn(username) {
		return this.currentTurn === username;
	}



	// start game
	startGame() {
		// returns false if the game has already started
		if (this.isGameStarted) return false;

		// ensure the minimum player count is met
		if (this.playersMap.size < 2) {
			this.broadcast("gameStartedFailed", {
				reason: "Not enough players"
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
		this.countDownToGameEnd = setTimeout(() => {
			this.endGame();
		}, 30 * 60 * 1000); // 30 mins

		// broadcast game start
		this.broadcast("gameStarted", {
			firstPlayer: this.currentTurn,
			players: this.turnOrder
		});

		return true;
	}



	// end game
	endGame() {
		if (this.isGameEnded) return false;

		// determine the winner
		this.roomWinner = this.determinedWinner();

		// Set game states
		this.isGameStarted = false;
		this.isGameEnded = true;
		this.isRoomActive = false;

		// Clear timers
		this.clearGameTimers();

		// Broadcast game end
		this.broadcast("gameEnded", {
			winner: this.roomWinner
		});

		return true;
	}



	// determine winner absed on points
	determineWinner() {
		let winner = null;
		let maxPoints = -1;

		for (const [username, playerData] of this.playersMap) {
			if (playerData.points > maxPoints) {
				winner = username;
				maxPoints = playerData.points;
			}
		}

		return winner;
	}



	// clear game timers
	clearGameTimers() {
		if (this.countDownToGameEnd) {
			clearTimeout(this.countDownToGameEnd);
			this.countDownToGameEnd = null;
		}

		if (this.countDownPerRound) {
			clearTimeout(this.countDownPerRound);
			this.countDownPerRound = null;
		}
	}

}

module.exports = GameRoom;