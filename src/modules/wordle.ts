import { bold, inlineCode, userMention } from "@discordjs/builders";
import { CommandInteraction, Message, TextChannel } from "discord.js";
import sharp from "sharp";
import { getMongoDatabase } from "./mongodb";

const wordlen = 5;
const attempts = 6;
const gap = 5;
const dim = 32;

const COLOR_ABSENT = '#787c7e';
const COLOR_EXACT = '#6aaa64';
const COLOR_PRESENT = '#c9b458';
const COLOR_EMPTY = '#ffffff';


class Wordle {
  curChannel: TextChannel | null;
  winnerWord: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userInput: any;
  numAttempts: number; 

  constructor() {
    this.curChannel = null;
    console.log('Wordle module loaded');
    this.numAttempts = 0;
    this.winnerWord = "";
    this.userInput = new Array(attempts);
    for (let i = 0; i < attempts; i++) {
      this.userInput[i] = new Array(wordlen);
    }
  }

  async validateWord(word: string): Promise<boolean> {
    
    if (word.length != wordlen) {
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

  async handleMessage(message: Message) {
    if (!message.content.startsWith('>') ||
      message.channel != this.curChannel || this.winnerWord === "") {
      return;
    }

    const word = message.content.substring(1).toLowerCase();

    const valid = await this.validateWord(word);
    if (!valid) {
      await message.react('❌');
      return;
    }

    this.userInput[this.numAttempts++] = word;

    const svg = await this.createPreviewSvg();
    let content = `${userMention(message.author.id)} guessed ${inlineCode(word)}.`;

    if (word === this.winnerWord) {
      content += ` ${bold('You win!')}`;
      this.reset();
    } else if (this.numAttempts >= attempts) {
      content += ` ${bold('You lose!')}\nThe word was \`${this.winnerWord}\``;
      this.reset();
    }

    await message.channel.send({
        files: [
          {
            attachment: svg,
            name: 'wordle.png'
          }],
        content: content});
  }

  reset() {
    this.winnerWord = '';
    this.numAttempts = 0;

    // clear the board
    for (let i = 0; i < attempts; i++) {
      this.userInput[i] = new Array(wordlen);
    }

    this.curChannel = null;
  }
  async getRandomWord(length: number): Promise<string | null> {

    const db = getMongoDatabase();
    if (!db) {
      return null;
    }

    const collection = db.collection('dictionary');
        const entry = await collection.aggregate([
      { $match: { l: length } },
      { $sample: { size: 1 } }
    ]).toArray();

    if (entry.length === 0) {
      return null;
    }
    return entry[0]['w'];
  }

  async handleInteraction(interaction: CommandInteraction) {
    if (this.winnerWord !== "") {
      await interaction.reply(`There is already a game in progress`);
      return;
    }

    this.winnerWord = await this.getRandomWord(wordlen);
    if (this.winnerWord === null) {
      await interaction.reply(`Internal error`);
      this.reset();
      return;
    }

    console.log(`Starting game of wordle with word: ${this.winnerWord}`);
    
    this.curChannel = interaction.channel as TextChannel;
    this.numAttempts = 0;
    
    await interaction.reply({
      content: `Started a game of wordle!`,
      files: [
        {
          attachment: await this.createPreviewSvg(),
          name: 'wordle.png'
        }
      ]
    });
  }

  async createPreviewSvg() {

    if (this.winnerWord === null) {
      throw new Error('No winner word');
    }

    const width = wordlen * dim + (wordlen - 1) * gap;
    const height = attempts * dim + (attempts - 1) * gap;

    let svgContent = `<svg width="${width}" height="${height}">`;

    let x = 0;
    let y = 0;

    for (let i = 0; i < attempts; i++) {

      for (let j = 0; j < wordlen; j++) {
        x = j * (dim + gap);
        y = i * (dim + gap);

        let color = '';

        const userChar: string = this.userInput[i][j];

        if (userChar != undefined) {

          //console.log(`There is input: ${userChar}`);
          color = COLOR_ABSENT;

          // check if character exists in winner word
          if (userChar == this.winnerWord.charAt(j)) {
            color = COLOR_EXACT; // green
          }
          else if (this.winnerWord.indexOf(userChar) > -1) {
            color = COLOR_PRESENT; // yellow
          }

          // square with char
          // svgContent += `
          //   <g>
          //   <rect x="${x}" y="${y}" width="${dim}" height="${dim}" fill="${color}" />
          //   <text x="${x + dim / 2}" y="${y + dim / 2}" text-anchor="middle" alignment-baseline="central" font-size="16" fill="black">${userChar.toUpperCase()}</text>
          //   </g>
          // `;

          svgContent += `
            <g>
              <rect x="${x}" y="${y}" width="${dim}" height="${dim}" fill="${color}" />
              <text
                  font-size="18"
                  font-family="Arial"
                  font-weight="bold"
                  x="${x + dim / 2}"
                  y="${y + dim / 2 + 5.0}"
                  dominant-baseline="middle"
                  text-anchor="middle">
                ${userChar.toUpperCase()}
              </text>
            </g>
          `
        }
        else { // empty square
          svgContent += `<rect x="${x}" y="${y}" width="${dim}" height="${dim}" fill="white" />`;
        }
      }
    }

    svgContent += `</svg>`;

    const buffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
    return buffer;
  }
}

const wordle = new Wordle();

export default wordle;