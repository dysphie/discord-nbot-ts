import { CommandInteraction, Guild, HTTPAttachmentData, Interaction, Message, MessageAttachment, MessageEmbed } from "discord.js";
import { Collection, ObjectId } from "mongodb";
import sharp from "sharp";
import { DatabaseModule } from "../module_mgr";
import { getMongoDatabase } from "../mongodb";
import { fmtTime } from "../utils";

const DEFAULT_WORD_LENGTH = 5;

const MIN_RARITY_SOLUTION = 1_000_000;
const MIN_RARITY_GUESS = 150_000;

const BOARD_TILE_GAP = 4;

const BOARD_TILE_HEIGHT = 32;
const BOARD_TILE_WIDTH = 32;

const KB_BUTTON_HEIGHT = 20;
const KB_BUTTON_WIDTH = 20;

const MAX_GUESSES = 6;


const KEYBOARD_LAYOUT = [
	["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
	["a", "s", "d", "f", "g", "h", "j", "k", "l"],
	["z", "x", "c", "v", "b", "n", "m"]
]

interface DbGame {
	word: string;
	guesses_list: string[];
	guesses: number;
	elapsed: number;
	players: string[];
	won: GameState; // this used to be a boolean, now it's a GameState
	date: Date;
	guild: string;
}

enum GuessStatus {
	Unknown,
	Correct,
	Elsewhere,
	Absent
}

enum GameState {
	Lost = 0,
	Won = 1,
	NotStarted,
	InProgress,
	Error
}

enum WordGuessResult {
	Accepted,
	TooRecent,
	Cooldown,
	NotAWord,
	BadLength,
	AlreadyGuessed,
	BadState
}


const getPlayedGamesCollection = () => {
	return getMongoDatabase()?.collection<DbGame>('wordle');
}

const getStatsCollection = () => {
	return getMongoDatabase()?.collection<GuildStats>('wordle.stats');
}

const guessStatusToColor = (guessStatus: GuessStatus) => {
	switch (guessStatus) {
		case GuessStatus.Correct:
			return ["#006843", 1.0];
		case GuessStatus.Elsewhere:
			return ["#C2410C", 1.0];
		case GuessStatus.Absent:
			return ["#202225", 1.0];
		default:
			//return ["#9CA3AF", 0.25];
			return ["#42464D", 1.0];
	}
}

interface GuildStats {
	totalPlayed: number;
	totalWon: number;
	winPct: number;
	avgGuesses: number;
	bestGuess: number;
	bestStreak: number;
	currentStreak: number;
	bestTime: number;
	guild: string;
}

class WordleStats {

	async getStats(guildId: string): Promise<GuildStats> {
		const stats = await getStatsCollection()?.findOne({ guild: guildId });
		if (!stats) {
			return {
				totalPlayed: 0,
				totalWon: 0,
				winPct: 0,
				avgGuesses: 0,
				bestGuess: 0,
				bestStreak: 0,
				currentStreak: 0,
				bestTime: 0,
				guild: guildId
			};
		}
		return stats;
	}

	async saveStats(guildId: string, stats: GuildStats) {
		await getStatsCollection()?.updateOne({ guild: guildId }, { $set: stats }, { upsert: true });
	}

	async recomputeStats(guildId: string): Promise<GuildStats> {

		const entries = await getPlayedGamesCollection()?.find({
			guild: guildId,
			won: { $in: [GameState.Won, GameState.Lost] }
		}).sort({ date: -1 }).toArray();

		console.log(`Got ${entries?.length} previous games`);

		const guessDistribution = new Array(MAX_GUESSES).fill(0);

		let totalGuesses = 0;
		let totalWon = 0;
		let currentStreak = 0;
		let bestStreak = 0;
		let bestGuess = Infinity;
		let bestTime = Infinity;
		let avgGuesses = Infinity;
		let totalPlayed = 0;

		if (entries) {
			entries.forEach(entry => {

				totalPlayed++;
				if (entry.won == GameState.Won) {

					// Update total won
					totalWon++;

					// Update current streak
					currentStreak++;

					// Update best streak
					if (currentStreak > bestStreak) {
						bestStreak = currentStreak;
					}

					// Update best guess
					if (entry.guesses < bestGuess) {
						bestGuess = entry.guesses;
					}

					if (entry.elapsed < bestTime) {
						bestTime = entry.elapsed;
					}

					totalGuesses += entry.guesses;

					// Update average guess
					guessDistribution[entry.guesses]++;

				} else {
					currentStreak = 0;
				}
			});
		}

		if (totalPlayed > 0) {
			avgGuesses = totalGuesses / totalPlayed;
		} else {
			avgGuesses = 0;
		}

		const winPct = totalPlayed > 0 ? (totalWon / totalPlayed * 100) : 0;

		const stats = {
			totalPlayed: totalPlayed,
			totalWon: totalWon,
			avgGuesses: avgGuesses,
			bestGuess: bestGuess,
			bestStreak: bestStreak,
			currentStreak: currentStreak,
			bestTime: bestTime,
			guild: guildId,
			winPct: winPct
		}

		await wordleStats.saveStats(guildId, stats);
		return stats;
	}
}

class WordleInterface {

	static async replyToWordleInteraction(msg: Message | CommandInteraction, game: Wordle, guildId: string) {

		const files = [{
			attachment: await WordleInterface.buildMainBoard(game),
			name: 'board.png'
		}];

		const embeds = [];

		if (game.state == GameState.InProgress) {
			files.push({
				attachment: await WordleInterface.buildKeyboard(game),
				name: 'wordle_keyboard.png'
			});
		}

		else {

			const stats = await wordleStats.recomputeStats(guildId);
			const embed = await WordleInterface.buildStatsEmbed(game, guildId, stats);

			if (game.state == GameState.Won) {
				embed.setTitle('You won!');
				embed.setColor("#0E7490");
			}
			else if (game.state == GameState.Lost) {
				embed.setTitle(`You lost! The word was ${game.solution}`);
				embed.setColor('#ff0000');
			}

			embeds.push(embed);
		}

		

		console.log(`msg.reply`);
		msg.channel?.send({
			files: files,
			embeds: embeds
		})
	}

	static async buildStatsEmbed(wordle: Wordle, guildId: string, stats: GuildStats) {

		const embed = new MessageEmbed();

		// get the elapsed time 
		let description = `\n\n**Elapsed**: \`${fmtTime(wordle.elapsedTime)}\` (Best: \`${fmtTime(stats.bestTime)}\`)`;
		if (wordle.elapsedTime == stats.bestTime) {
			description += ' 🏅';
		}

		description += `\n**Winrate**: \`${Math.round(stats.winPct)}%\` (\`${stats.totalWon}/${stats.totalPlayed}\`)`;
		description += `\n**Avg. Guesses**: \`${stats.avgGuesses.toFixed(1)}\` (Best: \`${stats.bestGuess}\`)`;

		description += `\n**Streak**: \`${stats.currentStreak}\` (Best: \`${stats.bestStreak}\`)`;
		if (stats.currentStreak == stats.bestStreak) {
			description += ' 🏅';
		}

		embed.setDescription(description);
		return embed;
	}

	static async buildKeyboard(wordle: Wordle) {

		let maxWidth = 0;
		let svgContent = '<svg>';

		KEYBOARD_LAYOUT.forEach((row, rowIndex) => {

			const rowLen = row.length;
			const maxRowWidth = rowLen * KB_BUTTON_WIDTH + (rowLen - 1) * BOARD_TILE_GAP;
			if (maxRowWidth > maxWidth) {
				maxWidth = maxRowWidth;
			}

			row.forEach((key, keyIndex) => {

				const x = keyIndex * (KB_BUTTON_WIDTH + BOARD_TILE_GAP);
				const y = rowIndex * (KB_BUTTON_HEIGHT + BOARD_TILE_GAP);

				const guessStatus = wordle.keyboard.get(key) || GuessStatus.Unknown;

				// if (guessStatus == GuessStatus.Absent) {
				// 	console.log(`key ${key} is absent`);
				// 	return;
				// }

				const [color, opacity] = guessStatusToColor(guessStatus);
				svgContent += `
					<rect 
						x="${x}" 
						y="${y}" 
						width="${KB_BUTTON_WIDTH}" 
						height="${KB_BUTTON_HEIGHT}" 
						fill="${color}" 
						fill-opacity="${opacity}"
						/>
					<text 
						x="${x + KB_BUTTON_WIDTH / 2}" 
						y="${y + KB_BUTTON_HEIGHT / 2 + 4.5}" 
						font-family="Arial"
						font-weight="bold"
						text-anchor="middle" 
						fill="white"
						>
						${key.toUpperCase()}
					</text>
					`;
			}
			);
		});

		svgContent += '</svg>';
		const buffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
		return buffer;
	}

	static async buildMainBoard(wordle: Wordle) {

		const wordLen = wordle.solution.length;
		const currentGuesses = wordle.guesses.length;


		let svgContent = '<svg>';

		for (let i = 0; i < MAX_GUESSES; i++) {
			for (let j = 0; j < wordLen; j++) {

				const x = j * (BOARD_TILE_WIDTH + BOARD_TILE_GAP);
				const y = i * (BOARD_TILE_HEIGHT + BOARD_TILE_GAP);

				// If these rows have a guess made for them, render it with the appropiate colors
				if (i < currentGuesses) {

					const resultRow = wordle.guessResults[i];
					const guess = wordle.guesses[i].charAt(j);
					const guessStatus = resultRow[j];
					const [color, opacity] = guessStatusToColor(guessStatus);
					const fontSize = 18;
					svgContent += `
	          <rect x="${x}" y="${y}" width="${BOARD_TILE_WIDTH}" height="${BOARD_TILE_HEIGHT}" fill="${color}" fill-opacity="${opacity}" />
	          <text
	              font-size="${fontSize}"
	              font-family="Arial"
	              font-weight="bold"
				  fill="white"
	              x="${x + BOARD_TILE_WIDTH * 0.5}"
	              y="${y + BOARD_TILE_HEIGHT * 0.5 + 5.5}"
	              dominant-baseline="central"
	              text-anchor="middle">
	            ${guess.toUpperCase()}
	          </text>
	      `;
				}
				// Else just render empty tiles
				else {
					const [color, opacity] = guessStatusToColor(GuessStatus.Unknown);

					svgContent += `
	        	<rect 
					x="${x}" 
					y="${y}" 
					width="${BOARD_TILE_WIDTH}" 
					height="${BOARD_TILE_HEIGHT}" 
					fill="${color}" fill-opacity="${opacity}"/>
	      `
				}
			}
		}

		svgContent += `</svg>`;
		const buffer = await sharp(Buffer.from(svgContent)).toBuffer();

		// padd with transparency to the right
		return buffer;
	}
}


// Input: 67000
// Output: 6

// Get the thousands digit


class WordleManager extends DatabaseModule {

	onGoing: Map<string, Wordle> = new Map<string, Wordle>();

	async commandWordle(interaction: CommandInteraction) {

		if (!interaction.guildId) {
			await interaction.reply('This command can only be used in a server');
			return;
		}

		let wordle = await this.getOnGoingWordle(interaction.guildId);
		if (!wordle) {

			wordle = new Wordle();

			let wantedLen = interaction.options.getInteger('length');
			if (wantedLen === null) {
				wantedLen = DEFAULT_WORD_LENGTH;
			}

			this.onGoing.set(interaction.guildId, wordle);

			try {
				await wordle.beginGame(wantedLen);
			}
			catch (err) {
				await interaction.reply('The server has gone up in flames sorry');
				return;
			}

			//wordle.pauseTimer();

			const starterWordCmd = interaction.options.getString('starter_words');
			if (starterWordCmd !== null) {
				const starterWords = starterWordCmd.split(/\s+/);

				console.log(`Ended up with ${starterWords.length} starter words`);

				for (const word of starterWords) {
					await wordle.performGuess(word, true, interaction.user.id);
				}
			}
		}

		this.gameToDb(interaction.guildId);
		await WordleInterface.replyToWordleInteraction(interaction, wordle, interaction.guildId);
		wordle.runTimer();

		if (wordle.state !== GameState.InProgress) {
			this.onGoing.delete(interaction.guildId);
		}
	}

	async getOnGoingWordle(guildId: string) {

		let wordle = this.onGoing.get(guildId);

		// Try getting a game from the db
		if (wordle) {
			return wordle;
		}

		wordle = await this.gameFromDb(guildId);
		if (wordle) {
			console.log(`Added wordle from db ${guildId} to ongoing`);
			this.onGoing.set(guildId, wordle);
			return wordle;
		}

		return null;
	}

	async handleMessage(message: Message) {

		if (!message.guildId || !message.content.startsWith('>') || !message.content.startsWith('.')) {
			return;
		}

		const word = message.content.substring(1);

		const wordle = await this.getOnGoingWordle(message.guildId);
		if (!wordle) {
			console.log(`Ignoring ${message.content} as no wordle is in progress`);
			return;
		}

		//wordle.pauseTimer();

		// Process guess here
		const result = await wordle.performGuess(word, true, message.author.id);

		switch (result) {
			case WordGuessResult.BadLength:
			case WordGuessResult.NotAWord:
				{
					await message.react('❌');
					//wordle.runTimer();
					break;
				}
			case WordGuessResult.TooRecent:
				{
					const embed = new MessageEmbed();
					embed.setDescription(`❌ You've recently started a game with this word`);
					embed.setColor(0xFF0000);
					await message.reply({
						embeds: [embed]
					});

					//wordle.runTimer();
					break;
				}
			case WordGuessResult.AlreadyGuessed:
				{
					const embed = new MessageEmbed();
					embed.setDescription(`❌ You've already guessed this word`);
					embed.setColor(0xFF0000);
					await message.reply({
						embeds: [embed]
					});

					//wordle.runTimer();
					break;
				}
			case WordGuessResult.Accepted:
				{
					this.gameToDb(message.guildId);
					await WordleInterface.replyToWordleInteraction(message, wordle, message.guildId);

					wordle.runTimer();
					break;
				}
		}

		if (wordle.state !== GameState.InProgress) {
			this.onGoing.delete(message.guildId);
		}
	}

	async gameToDb(guildId: string) {

		const dbGames = getPlayedGamesCollection();
		if (!dbGames) {
			console.log('gameToDb: dbGames is null');
			return;
		}

		const game = this.onGoing.get(guildId);
		if (!game) {
			return;
		}

		const dbGame: DbGame = {
			word: game.solution,
			guesses: game.guesses.length,
			guesses_list: game.guesses,
			elapsed: game.elapsedTime,
			players: game.participants,
			won: game.state,
			date: new Date(),
			guild: guildId
		};

		if (game.dbId !== null) {
			dbGames.updateOne({ _id: game.dbId }, { $set: dbGame }, { upsert: true });
		}
		else {
			const dbId = await dbGames.insertOne(dbGame);
			game.dbId = dbId.insertedId;
		}
	}

	async gameFromDb(guildId: string): Promise<Wordle | undefined> {

		const dbGames = getPlayedGamesCollection();
		if (!dbGames) {
			console.log('gameFromDb: dbGames is null');
			return;
		}

		const dbGame = await dbGames.findOne({
			guild: guildId,
			won: GameState.InProgress
		});

		if (!dbGame) {
			return undefined;
		}

		const game = new Wordle();

		game.solution = dbGame.word;
		game.elapsedTime = dbGame.elapsed;
		game.state = dbGame.won;
		console.log(`Got state from db ${dbGame.won}`);
		game.dbId = dbGame._id;

		// Rebuild the board
		dbGame.guesses_list.forEach(guess => {
			game.performGuess(guess, false, '0');
		});

		game.participants = dbGame.players;

		return game;
	}

}

class Wordle {

	dbId: ObjectId | null = null;
	state: GameState = GameState.NotStarted;
	solution = '';
	guesses: string[] = [];
	guessResults: Array<Array<GuessStatus>> = [];
	participants: string[] = [];
	keyboard: Map<string, GuessStatus> = new Map<string, GuessStatus>();
	startTime = 0;
	elapsedTime = 0;

	async beginGame(length: number): Promise<boolean> {

		const chosenWord = await dictionary.getRandomWord(length, MIN_RARITY_SOLUTION);
		if (!chosenWord) {
			return false;
		}

		console.log(`Started wordle game with word ${chosenWord}`);

		this.solution = chosenWord;
		this.state = GameState.InProgress;
		this.startTime = Date.now();
		return true;
	}

	async performGuess(guess: string, validate: boolean, playerId: string): Promise<WordGuessResult> {

		console.log(`Guessing word ${guess}`);
		if (this.state !== GameState.InProgress) {
			return WordGuessResult.BadState;
		}

		if (guess.length !== this.solution.length) {
			return WordGuessResult.BadLength;
		}

		// check if this word is already guessed
		if (this.guesses.indexOf(guess) !== -1) {
			return WordGuessResult.AlreadyGuessed;
		}

		if (validate) {
			const exists = await dictionary.wordExists(guess, MIN_RARITY_GUESS);
			if (!exists) {
				return WordGuessResult.NotAWord;
			}
		}

		const solutionChars = [...this.solution];
		const result: GuessStatus[] = Array(5).fill(GuessStatus.Absent);

		// Find greens
		[...guess].forEach((c, i) => {
			if (solutionChars[i] === c) {
				solutionChars[i] = '';
				result[i] = GuessStatus.Correct;
				this.keyboard.set(c, GuessStatus.Correct);
			}
		});

		// Find yellows
		[...guess].forEach((c, i) => {

			if (result[i] === GuessStatus.Correct) {
				return;
			}

			const idx = solutionChars.indexOf(c);
			if (idx !== -1) {
				solutionChars[idx] = '';
				result[i] = GuessStatus.Elsewhere;

				if (!this.keyboard.has(c)) {
					this.keyboard.set(c, GuessStatus.Elsewhere);
				}
			}
			else {
				this.keyboard.set(c, GuessStatus.Absent);
			}
		});

		this.guesses.push(guess);
		this.guessResults.push(result);
		this.participants.push(playerId);

		// check if all the boxes are green
		if (result.every(r => r === GuessStatus.Correct)) {
			this.endGame(true);
		} else if (this.guessResults.length >= MAX_GUESSES) {
			this.endGame(false);
		}

		return WordGuessResult.Accepted;
	}

	endGame(won: boolean) {
		this.state = won ? GameState.Won : GameState.Lost;
		this.elapsedTime = Date.now() - this.startTime;
	}

	// pauseTimer() {
	// 	if (this.lastStartTime !== 0) {
	// 		this.elapsedTime += Date.now() - this.lastStartTime;
	// 	} else {
	// 		this.elapsedTime = 0;
	// 	}
	// }

	runTimer() {
		this.startTime = Date.now();
	}
}

class Dictionary {

	async getRandomWord(length: number, minFrequency: number): Promise<string | null> {

		//return 'hello';
		const collection = getMongoDatabase()?.collection('dictionary');
		if (!collection) {
			return null;
		}

		const entry = await collection.aggregate([
			{
				$match: {
					l: length,
					f: { $gt: minFrequency }
				}
			},
			{ $sample: { size: 1 } }
		]).toArray();

		if (entry.length === 0) {
			return null;
		}

		return entry[0]['w'];
	}

	async wordExists(word: string, minFrequency: number): Promise<boolean> {
		const collection = getMongoDatabase()?.collection('dictionary');
		if (collection) {
			const entry = await collection?.findOne(
				{
					w: word,
					f: { $gt: minFrequency }
				}
			);
			if (entry === null) {
				return false;
			}
		}

		return true;
	}
}

const dictionary = new Dictionary();
const wordleStats = new WordleStats();
const wordleMgr = new WordleManager('wordle', 'Play game of Wordle');


// const testWordle = async () => {

// 	const wordle = new Wordle();
// 	await wordle.beginGame(5);

// 	await wordle.performGuess('peynh', true);
// 	await wordle.performGuess('blris', true);
// 	await wordle.performGuess('bhllo', true);

// 	const board = await WordleRenderer.renderBoard(wordle);
// 	const kboard = await WordleRenderer.renderKeyboard(wordle);

// 	// export both files
// 	sharp(board).toFile('board.png');
// 	sharp(kboard).toFile('kboard.png');

// }

export { wordleMgr };