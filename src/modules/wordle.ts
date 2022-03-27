import { bold, inlineCode, userMention } from "@discordjs/builders";
import axios from "axios";
import { CommandInteraction, GuildMember, Message, TextChannel } from "discord.js";
import sharp from "sharp";
import { getMongoDatabase } from "./mongodb";

const DEFAULT_ATTEMPTS = 6;

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
      interaction.reply("A game is already in progress in this channel.");
      return false;
    }

    const wordle = new Wordle();
    await wordle.beginGame(interaction);
    this.games.push(wordle);
    return true;
  }
}

class Wordle {
  guesses: Array<Array<Guess>>;
  playerHistory: Array<string>;
  winnerWord: string;
  numAttempts: number;
  channel: TextChannel | null;

  guessKeyBoard: Array<Guess> = [];

  keyboardColors: Map<string, GuessStatus>;
  maxAttempts: number;


  constructor() {
    this.channel = null;
    this.numAttempts = 0;
    this.winnerWord = '';
    this.guesses = [];
    this.playerHistory = [];
    this.keyboardColors = new Map();
    this.maxAttempts = DEFAULT_ATTEMPTS;

    for (const row of keyboard) {
      for (const letter of row) {
        this.guessKeyBoard.push({ letter: letter, status: GuessStatus.Unknown });
      }
    }
  }

  async beginGame(interaction: CommandInteraction): Promise<void> {
    this.channel = interaction.channel as TextChannel;
    await this.generateRandomWord(5);
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

    return true;
    // if (word.length != this.winnerWord?.length) {
    //   return false;
    // }

    // const db = getMongoDatabase();
    // if (!db) {
    //   return false;
    // }

    // const collection = db.collection('dictionary');
    // const entry = await collection.findOne({ w: word });
    // if (entry === null) {
    //   return false;
    // }
    // return true;
  }

  async doGuess(message: Message) {
    const guess = message.content.substring(1).toLowerCase();

    const valid = await this.validateWord(guess);
    if (!valid) {
      await message.react('❌');
      return;
    }

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

    await message.reply({
      files: await this.getAttachments()
    })

    let continueGame = true;
    if (guess === this.winnerWord) {
      await message.channel.send(` ${bold('You win!')}`);
      continueGame = false;
    } else if (this.numAttempts >= this.maxAttempts) 
    {
      await message.channel.send(` ${bold('You lose!')}\nThe word was \`${this.winnerWord}\``);
      continueGame = false;
    }
    
    return continueGame;
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
    const height = this.maxAttempts * BOARD_TILE_HEIGHT + (this.maxAttempts - 1) * BOARD_TILE_GAP;

    let svgContent = `<svg width="${width}" height="${height}">`;

    for (let i = 0; i < this.maxAttempts; i++) {
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
    const buffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
    return buffer;
  }
}

const wordle = new WordleManager();

export default wordle;