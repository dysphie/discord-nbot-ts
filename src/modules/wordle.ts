import { CommandInteraction, Message, MessageEmbed } from "discord.js";
import { ObjectId } from "mongodb";
import sharp from "sharp";
import { DatabaseModule } from "../module_mgr";
import { getMongoDatabase } from "../mongodb";
import { fmtTime } from "../utils";

const IS_DEBUG = true;

const DEFAULT_WORD_LENGTH = 5;

const MIN_RARITY_SOLUTION = 1_000_000;
const MIN_RARITY_GUESS = 150_000;

const BOARD_TILE_GAP = 10;

const BOARD_TILE_HEIGHT = 128;
const BOARD_TILE_WIDTH = 128;
const BOARD_FONT_SIZE = 100;

const KB_BUTTON_HEIGHT = 64;
const KB_BUTTON_WIDTH = 64;
const KB_FONT_SIZE = 50;

const MAX_GUESSES = 6;

const KEYBOARD_LAYOUT = [
	["q", "w", "e", "r", "t", "y", "u", "i", "o"],
	["a", "s", "d", "f", "g", "h", "j", "k", "l"],
	["z", "x", "c", "v", "b", "n", "m", "p"]
]

interface DbGame {
	word: string;
	guesses_list?: string[];
	guesses: number;
	elapsed?: number;
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


const getGameStorage = () => {
	//return getMongoDatabase()?.collection<DbGame>('wordle');
	return getMongoDatabase()?.collection('wordle');
}

const getStatsStorage = () => {
	return getMongoDatabase()?.collection<GuildStats>('wordle.stats');
}

const guessStatusToColor = (guessStatus: GuessStatus) => {
	switch (guessStatus) {
		case GuessStatus.Correct:
			return "#519638";
		case GuessStatus.Elsewhere:
			return "#C27833";
		case GuessStatus.Absent:
			return "#202225";
		default:
			return "#42464D";
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
		const stats = await getStatsStorage()?.findOne({ guild: guildId });
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
		await getStatsStorage()?.updateOne({ guild: guildId }, { $set: stats }, { upsert: true });
	}

	async recomputeStats(guildId: string): Promise<GuildStats> {

		const entries = await getGameStorage()?.find({
			guild: guildId,
			won: {$ne: 3 }, // FIXME: GameState.InProgress does not work for some reason
			date: { $exists: true }
		}).sort({ date: 1 }).toArray();

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

					if (entry.elapsed !== undefined && entry.elapsed < bestTime) {
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
		
		const gameboard = await WordleInterface.buildBoard(game);

		const embeds = [];

		if (game.state !== GameState.InProgress)
		{
			const stats = await wordleStats.recomputeStats(guildId);
			const embed = await WordleInterface.buildStatsEmbed(game, guildId, stats);

			if (game.state == GameState.Won) {
				embed.setTitle('You won!');
				embed.setColor(guessStatusToColor(GuessStatus.Correct));
			}
			else if (game.state == GameState.Lost) {
				embed.setTitle(`You lost!`);
				embed.setDescription(`The word was: \`${game.solution}\``);
				embed.setColor('#ff0000');
			}

			embeds.push(embed);
		}

		if (msg instanceof CommandInteraction) {
			await msg.reply({
				files: [gameboard],
				embeds: embeds
			});
		}
		else {
			await msg.channel.send({
				files: [gameboard],
				embeds: embeds
			});
		}
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
		if (wordle.guesses.length == stats.bestGuess) {
			description += ' 🏅';
		}

		description += `\n**Streak**: \`${stats.currentStreak}\` (Best: \`${stats.bestStreak}\`)`;
		if (stats.currentStreak == stats.bestStreak) {
			description += ' 🏅';
		}

		embed.setDescription(description);
		return embed;
	}


	static async buildBoard(wordle: Wordle) {

		const wordLen = wordle.solution.length;
		const currentGuesses = wordle.guesses.length;

		let svgContent = '<svg>';

		let y = 0;

		for (let i = 0; i < MAX_GUESSES; i++) {

			for (let j = 0; j < wordLen; j++) {

				const x = j * (BOARD_TILE_WIDTH + BOARD_TILE_GAP);

				// If these rows have a guess made for them, render it with the appropiate colors
				if (i < currentGuesses) {

					const resultRow = wordle.guessResults[i];
					const guess = wordle.guesses[i].charAt(j);
					const guessStatus = resultRow[j];
					const color = guessStatusToColor(guessStatus);

					svgContent += `
	          <rect x="${x}" y="${y}" width="${BOARD_TILE_WIDTH}" height="${BOARD_TILE_HEIGHT}" fill="${color}" />
	          <text
	              font-size="${BOARD_FONT_SIZE}"
	              font-family="Arial"
	              font-weight="800"
				  fill="white"
	              x="${x + BOARD_TILE_WIDTH * 0.5}"
	              y="${y + BOARD_TILE_HEIGHT * 0.5 + 34.0}"
	              dominant-baseline="central"
	              text-anchor="middle">
	            ${guess.toUpperCase()}
	          </text>
	      `;
				}
				// Else just render empty tiles
				else {
					const color = guessStatusToColor(GuessStatus.Unknown);
					svgContent += `
	        	<rect 
					x="${x}" 
					y="${y}" 
					width="${BOARD_TILE_WIDTH}" 
					height="${BOARD_TILE_HEIGHT}" 
					fill="${color}"/>
	      `
				}
			}

			y += BOARD_TILE_HEIGHT + BOARD_TILE_GAP;
		}

		// Space between the board and the keyboard
		y += BOARD_TILE_GAP * 2;

		// Add Keyboard
		let maxWidth = 0;
		KEYBOARD_LAYOUT.forEach((row) => {

			const rowLen = row.length;
			const maxRowWidth = rowLen * KB_BUTTON_WIDTH + (rowLen - 1) * BOARD_TILE_GAP;
			if (maxRowWidth > maxWidth) {
				maxWidth = maxRowWidth;
			}

			row.forEach((key, keyIndex) => {

				const x = keyIndex * (KB_BUTTON_WIDTH + BOARD_TILE_GAP);

				const guessStatus = wordle.keyboard.get(key) || GuessStatus.Unknown;

				const color = guessStatusToColor(guessStatus);
				svgContent += `
					<rect 
						x="${x}" 
						y="${y}" 
						width="${KB_BUTTON_WIDTH}" 
						height="${KB_BUTTON_HEIGHT}" 
						fill="${color}"
						/>
					<text 
						x="${x + KB_BUTTON_WIDTH / 2}" 
						y="${y + KB_BUTTON_HEIGHT / 2 + 16}" 
						font-size="${KB_FONT_SIZE}"
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

			y += KB_BUTTON_HEIGHT + BOARD_TILE_GAP;
		});

		svgContent += '</svg>';

		const buf = await sharp(Buffer.from(svgContent)).webp().toBuffer();
		return buf;
	}
}


class WordleManager extends DatabaseModule {

	onGoing: Map<string, Wordle> = new Map<string, Wordle>();

	

	async debugGetStats(guildId: string) {

		// strip whitespace from the guildId
		guildId = guildId.trim();
		await wordleStats.recomputeStats(guildId);
	}

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

			const starterWordCmd = interaction.options.getString('starter_words');
			if (starterWordCmd !== null) {
				const starterWords = starterWordCmd.split(/\s+/);

				// TODO: Build message with errors
				for (const word of starterWords) {
					await wordle.performGuess(word, true, interaction.user.id, interaction.guildId);
				}
			}
		}

		this.gameToDb(interaction.guildId);
		await WordleInterface.replyToWordleInteraction(interaction, wordle, interaction.guildId);

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
			this.onGoing.set(guildId, wordle);
			return wordle;
		}

		return null;
	}

	async handleMessage(message: Message) {

		if (!message.guildId || (!message.content.startsWith('>') && !message.content.startsWith('.'))) {
			return;
		}

		const word = message.content.substring(1);

		const wordle = await this.getOnGoingWordle(message.guildId);
		if (!wordle) {
			return;
		}

		// Process guess here
		const result = await wordle.performGuess(word, true, message.author.id, message.guildId);

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
					embed.setDescription(`❌ You've recently guessed this word`);
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
					break;
				}
		}

		if (wordle.state !== GameState.InProgress) {
			this.onGoing.delete(message.guildId);
		}
	}

	async gameToDb(guildId: string) {

		const dbGames = getGameStorage();
		if (!dbGames) {
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

		const dbGames = getGameStorage();
		if (!dbGames) {
			return;
		}

		const dbGame = await dbGames.findOne({
			guild: guildId,
			won: GameState.InProgress
		});

		if (!dbGame || dbGame.guesses_list === undefined) {
			return undefined;
		}

		const game = new Wordle();

		game.solution = dbGame.word;

		if (dbGame.elapsed !== undefined) {
			game.elapsedTime = dbGame.elapsed;
			// TODO: Set start time here
		}

		game.state = dbGame.won;
		game.dbId = dbGame._id;

		// Rebuild the board
		dbGame.guesses_list.forEach((guess: string) => {
			game.performGuess(guess,
				false, // Don't validate guesses, assume they've been before
				'0', '0'); // TODO: userids and guild Ids
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

	async performGuess(guess: string, validate: boolean, playerId: string, guildId: string): Promise<WordGuessResult> {

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

			// const isOriginal = await dictionary.isOriginalWord(guess, guildId);
			// if (!isOriginal && guess != this.solution) {
			// 	return WordGuessResult.TooRecent;
			// }
		}

		const solutionChars = [...this.solution];
		const result: GuessStatus[] = Array(this.solution.length).fill(GuessStatus.Absent);

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
				if (!this.keyboard.has(c)) {
					this.keyboard.set(c, GuessStatus.Absent);
				}
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
}

class Dictionary {

	async getCollection() {
		return getMongoDatabase()?.collection('dictionary');
	}

	async getRandomWord(length: number, minFrequency: number): Promise<string | null> {

		// if (IS_DEBUG) {
		// 	return 'hello';
		// }

		const collection = await this.getCollection();
		if (collection === undefined) {
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

	async isOriginalWord(word: string, guildId: string): Promise<boolean> {

		const recentWords = getMongoDatabase()?.collection('wordle.recent');
		const result = await recentWords?.updateOne({
			w: word,
			d: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
			g: guildId
		}, { $set: { w: word, d: new Date(), g: guildId } }, { upsert: true });

		return result === undefined || result.matchedCount === 0;
	}


	async wordExists(word: string, minFrequency: number): Promise<boolean> {

		// if (IS_DEBUG) {
		// 	return true;
		// }

		const collection = await this.getCollection();
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