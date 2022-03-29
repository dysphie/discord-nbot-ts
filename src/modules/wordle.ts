import { bold, inlineCode, userMention } from "@discordjs/builders";
import axios from "axios";
import { CommandInteraction, GuildMember, Message, MessageAttachment, MessageEmbed, TextChannel } from "discord.js";
import sharp from "sharp";
import { getMongoDatabase } from "./mongodb";

const MAX_ATTEMPTS = 6;

const BOARD_TILE_GAP = 1;

const BOARD_TILE_HEIGHT = 20;
const BOARD_TILE_WIDTH = 32;

const KB_BUTTON_HEIGHT = 20;
const KB_BUTTON_WIDTH = 20;

enum GuessStatus {
  Unknown,
  Absent,
  Present,
  Correct
}


const colors = new Map<GuessStatus, string>();
colors.set(GuessStatus.Unknown, "#ffffff");
colors.set(GuessStatus.Correct, "#6aaa64");
colors.set(GuessStatus.Present, "#c9b458");
colors.set(GuessStatus.Absent, "#787c7e");

interface Guess {
  letter: string;
  status: GuessStatus;
}
const keyboard: Array<Array<string>> = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"]
]



const KB_MAX_WIDTH = Math.max(...keyboard.map(row => row.length)) * KB_BUTTON_WIDTH;
const KB_MAX_LENGTH = keyboard.length * KB_BUTTON_HEIGHT;

class WordleManager {
  games: Array<Wordle> = [];

  async handleMessage(message: Message): Promise<boolean> {
    if (!message.content.startsWith(">")) {
      return false;
    }

    // find game where channel is the same
    const game = this.games.find(g => g.channel?.id === message.channel.id);
    if (game) {
      const continueGame = await game.doGuess(message);
      if (!continueGame) {
        this.games = this.games.filter(g => g !== game);
      }
    }

    return true;
  }

  async handleInteraction(interaction: CommandInteraction): Promise<boolean> {

    
    const game = this.games.find(g => g.channel?.id === interaction.channel?.id);
    if (game) {
      await game.displayGraphics(interaction);
      return false;
    }

    const wordle = new Wordle();
    await wordle.beginGame(interaction);
    this.games.push(wordle);
    return true;
  }
}

interface DbGame {
  word: string,
  guesses: number,
  players: Array<string>,
  date: Date,
  won: boolean,
  guild: string
}

interface GuildStats {
  totalPlayed: number;
  totalWon: number;
  guessDistribution: Array<number>;
  maxWinStreak: number;
  currentWinStreak: number;
}

class Wordle {
  lastGuessTime: Date | null;
  guesses: Array<Array<Guess>>;
  playerHistory: Array<string>;
  winnerWord: string;
  channel: TextChannel | null;
  keyboardColors: Map<string, GuessStatus>;
  numAttempts: number;
  won: boolean;


  constructor() {
    this.lastGuessTime = null;
    this.channel = null;
    this.numAttempts = 0;
    this.winnerWord = '';
    this.guesses = [];
    this.playerHistory = [];
    this.keyboardColors = new Map();
    this.won = false;
  }

  async beginGame(interaction: CommandInteraction): Promise<void> {

    let wantedLen = interaction.options.getInteger('length');
    if (wantedLen === null) {
      wantedLen = 5;
    }

    this.channel = interaction.channel as TextChannel;
    await this.generateRandomWord(wantedLen);
    console.log("Starting a new game of wordle with word " + this.winnerWord);

    await interaction.reply({
      files: await this.getAttachments(),
      content: "A new game of wordle has started!"
    });
  }

  async getAttachments() {
    return [
        {
          attachment: await this.buildBoardSvg(),
          name: 'board.png'
        },
        {
          attachment: await this.createPreviewKeyboard(),
          name: 'wordle_keyboard.png'
        }
      ];
  }

  async validateWord(word: string): Promise<boolean> {

    if (word.length != this.winnerWord?.length) {
      return false;
    }

    const db = getMongoDatabase();
    if (!db) {
      return false;
    }

    const collection = db.collection('dictionary');
    const entry = await collection.findOne({ w: word });
    if (entry === null) {
      return false;
    }
    return true;
  }

  async saveToDb()
  {
    const db = getMongoDatabase();
    if (!db || !this.channel) {
      return;
    }

    const collection = db.collection('wordle');

    const game: DbGame = {
      word: this.winnerWord,
      guesses: this.numAttempts,
      players: this.playerHistory,
      date: new Date(),
      won: this.won,
      guild: this.channel.guild.id
    }

    await collection.insertOne(game);
  }

  async getStatsForGuild(guildId: string): Promise<GuildStats|null> {
    const db = getMongoDatabase();
    if (!db) {
      return null;
    }

    const collection = db.collection('wordle');
    let entries = await collection.find({ guild: guildId }).toArray();

    entries = entries.sort((a, b) => {
      if (a.date < b.date) {
        return -1;
      }
      if (a.date > b.date) {
        return 1;
      }
      return 0;
    });

    let newestStreak = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let resetOnce = false;
    
    // iterate entries backwards
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].won) {
        currentStreak++;

        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }

        if (!resetOnce) {
          newestStreak = currentStreak;
        }

      } else {
        currentStreak = 0;
        resetOnce = true;
      }
    }

    if (!resetOnce) {
      newestStreak = currentStreak;
    }

    const numAttempts = new Array(MAX_ATTEMPTS).fill(0);
    // fill in the array with the number of attempts
    for (let i = 0; i < entries.length; i++) {
      const guessIndex = entries[i].guesses - 1;
      numAttempts[guessIndex]++;
      //console.log(`in ${entries[i].guesses} attempts: ${numAttempts[entries[i].guesses]}`);
    }

    const numPlayed = entries.length;
    const numWon = entries.filter(e => e.won).length;

    const stats = {
      totalPlayed: numPlayed,
      totalWon: numWon,
      guessDistribution: numAttempts,
      maxWinStreak: longestStreak,
      currentWinStreak: newestStreak
    }

    //console.log(stats);
    return stats;
  }

  async doGuess(message: Message) {
    const guess = message.content.substring(1).toLowerCase();

    const valid = await this.validateWord(guess);
    if (!valid) {
      await message.react('❌');
      return true;
    }

    // TODO: if we've already guessed this word, disallow

    const curTime = new Date();

    // if less than 3 seconds have passed since the last guess, don't allow it
    if (this.lastGuessTime && curTime.getTime() - this.lastGuessTime.getTime() < 3000) {
      await message.react('⏱');
      return true;
    }

    this.playerHistory.push(message.author.id);

    const maxlen = this.winnerWord.length;

    const lineGuess = new Array(maxlen);
    
    for (let i = 0; i < maxlen; i++) {
      lineGuess[i] = { letter: guess[i], status: GuessStatus.Unknown };
    }

    const guessArr = guess.split('');
    const filteredWord = this.winnerWord.split('');

    // Find all full matches
    for (let i = 0; i < maxlen; i++) {
      if (filteredWord[i] === guessArr[i]) {
        guessArr[i] = '\0';
        filteredWord[i] = '\0';
        lineGuess[i].status = GuessStatus.Correct;
        this.updateKeyboard(lineGuess[i]);
      }
    }

    // Find all partial matches
    for (let i = 0; i < maxlen; i++) {
      if (filteredWord[i] === '\0' || guessArr[i] === '\0') {
        continue;
      }

      if (filteredWord.includes(guessArr[i])) {
        lineGuess[i].status = GuessStatus.Present;
        this.updateKeyboard(lineGuess[i]);
      } else {
        lineGuess[i].status = GuessStatus.Absent;
        this.updateKeyboard(lineGuess[i]);
      }
    }

    this.guesses.push(lineGuess);
    this.numAttempts++;

    await this.displayGraphics(message);

    let description = '';

    let continueGame = true;
    if (guess === this.winnerWord) {
      this.won = true;
      continueGame = false;
    } else if (this.numAttempts >= MAX_ATTEMPTS) 
    {
      description = `The word was \`${this.winnerWord}\``;
      continueGame = false;
    }

    if (!continueGame && this.channel) {
      await this.saveToDb();
      await this.printStats(this.won, description);
    }

    this.lastGuessTime = curTime;
    return continueGame;
  }

  async displayGraphics(message: Message|CommandInteraction) {
    
    await message.reply({
      files: await this.getAttachments()
    })
  }

  async printStats(didWin: boolean, description: string) {

    if (!this.channel) {
      return;
    }

    const stats = await this.getStatsForGuild(this.channel.guild.id);
    if (!stats) {
      return;
    }

    let bestGuess = -1;
    for (let i = 0; i < stats.guessDistribution.length; i++) {
      if (stats.guessDistribution[i] > 0) {
        bestGuess = i + 1;
        break;
      }
    }
      
    const avgGuessAmt = stats.guessDistribution.reduce((a, b) => a + b, 0) / stats.guessDistribution.length;
    const winPct = (stats.totalWon / stats.totalPlayed * 100).toFixed(2);
  
    const embed = new MessageEmbed();

    if (this.won) {
      embed.setTitle('You won!');
      embed.setColor('#64AA6A');
    } else {
      embed.setTitle('You lost!');
      embed.setColor('#ff0000');
    }

    description += `\n\n**Winrate**: \`${winPct}%\` (\`${stats.totalWon}/${stats.totalPlayed}\`)`;
    description += `\n**Guess ratio**: \`${avgGuessAmt.toFixed(1)}\` (Best: \`${bestGuess}\`)`;
    description += `\n**Streak**: \`${stats.currentWinStreak}\` (Best: \`${stats.maxWinStreak}\`)`;
    embed.setDescription(description);
    
    await this.channel.send({
      embeds: [embed]
    });
  }

  async generateRandomWord(length: number) {

    const db = getMongoDatabase();
    if (!db) {
      return;
    }

    const collection = db.collection('dictionary');
    const entry = await collection.aggregate([
      { $match: { l: length } },
      { $sample: { size: 1 } }
    ]).toArray();

    if (entry.length === 0) {
      return;
    }
    this.winnerWord = entry[0]['w'];
  }

  updateKeyboard(guess: Guess) {
    const curStatus = this.keyboardColors.get(guess.letter);
    if (!curStatus || guess.status > curStatus) {
      this.keyboardColors.set(guess.letter, guess.status);
    }
  }

  async createPreviewKeyboard() {

    let maxWidth = 0;
    const maxHeight =  3 * KB_BUTTON_HEIGHT + 2 * BOARD_TILE_GAP;

    let svgContent = '';

    keyboard.forEach((row, rowIndex) => {

      const rowWidth = row.length * KB_BUTTON_WIDTH + (row.length - 1) * BOARD_TILE_GAP;
      if (rowWidth > maxWidth) {
        maxWidth = rowWidth;
      }

      //const rowWidth = row.length * KB_BUTTON_WIDTH + (row.length - 1) * BOARD_TILE_GAP;
      // offset from maxWidth to center the row
      //const rowX = (KB_MAX_WIDTH - rowWidth) / 2;

      row.forEach((key, keyIndex) => {
        const x = keyIndex * (KB_BUTTON_WIDTH + BOARD_TILE_GAP);
        const y = rowIndex * (KB_BUTTON_HEIGHT + BOARD_TILE_GAP);

        //console.log(`Requesting color for ${key}`);
        const guessStatus = this.keyboardColors.get(key) || GuessStatus.Unknown;
        const color = colors.get(guessStatus);
        svgContent += `
          <rect x="${x}" y="${y}" width="${KB_BUTTON_WIDTH}" height="${KB_BUTTON_HEIGHT}" fill="${color}" />
          <text 
            x="${x + KB_BUTTON_WIDTH / 2}" 
            y="${y + KB_BUTTON_HEIGHT / 2 + 4.5}" 
            font-family="Arial"
            font-weight="bold"
            text-anchor="middle" 
            fill="black">
            ${key.toUpperCase()}
          </text>
        `;
      }
      );
    });

    svgContent += '</svg>';

    svgContent = `<svg width="${maxWidth}" height="${maxHeight}">` + svgContent;
    const buffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
    return buffer;
  }

  async buildBoardSvg() {

    if (this.winnerWord === null) {
      throw new Error('No winner word');
    }

    const wordLen = this.winnerWord.length;

    const width = this.winnerWord.length * BOARD_TILE_WIDTH + (wordLen - 1) * BOARD_TILE_GAP;
    const height = MAX_ATTEMPTS * BOARD_TILE_HEIGHT + (MAX_ATTEMPTS - 1) * BOARD_TILE_GAP;

    let svgContent = `<svg width="${width}" height="${height}">`;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      for (let j = 0; j < wordLen; j++) {

        const x = j * (BOARD_TILE_WIDTH + BOARD_TILE_GAP);
        const y = i * (BOARD_TILE_HEIGHT + BOARD_TILE_GAP);

        if (i < this.numAttempts) {

          const guess = this.guesses[i][j];
          const color = colors.get(guess.status);
          const fontSize = 18;
          svgContent += `
            <g>
              <rect x="${x}" y="${y}" width="${BOARD_TILE_WIDTH}" height="${BOARD_TILE_HEIGHT}" fill="${color}" />
              <text
                  font-size="${fontSize}"
                  font-family="Arial"
                  font-weight="bold"
                  x="${x + BOARD_TILE_WIDTH * 0.5}"
                  y="${y + BOARD_TILE_HEIGHT * 0.5 + 5.5}"
                  dominant-baseline="central"
                  text-anchor="middle">
                ${guess.letter.toUpperCase()}
              </text>
            </g>
          `;
        }
        else {
          svgContent += `
          <g>
            <rect x="${x}" y="${y}" width="${BOARD_TILE_WIDTH}" height="${BOARD_TILE_HEIGHT}" fill="white" />
          </g>
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

const wordle = new WordleManager();

export default wordle;