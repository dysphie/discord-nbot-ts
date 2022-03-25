import { bold, inlineCode, userMention } from "@discordjs/builders";
import axios from "axios";
import { CommandInteraction, GuildMember, Message, TextChannel } from "discord.js";
import sharp from "sharp";
import { getMongoDatabase } from "./mongodb";

const attempts = 6;
const gap = 5;
const dim = 32;

const COLOR_ABSENT = '#787c7e';
const COLOR_EXACT = '#6aaa64';
const COLOR_PRESENT = '#c9b458';
const COLOR_EMPTY = '#ffffff';


class Pogle {
  curChannel: TextChannel | null;
  winnerWord: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userInput: any;
  numAttempts: number; 
  pfpColumn: Buffer | null;

  constructor() {
    this.pfpColumn = null;
    this.curChannel = null;
    console.log('Wordle module loaded');
    this.numAttempts = 0;
    this.winnerWord = "";
    this.userInput = new Array(attempts);
    for (let i = 0; i < attempts; i++) {
      this.userInput[i] = [];
    }
  }

  async validateWord(word: string): Promise<boolean> {
    
    if (word.length != this.winnerWord?.length) {
      return false;
    }

    const db = getMongoDatabase();
    if (!db) {
      return false;
    }

    const collection = db.collection('emoter.emotes');
    const entry = await collection.findOne({ _id: word });
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

    const svg = await this.createPreviewSvg(message.member as GuildMember);
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
      this.userInput[i] = [];
    }

    this.curChannel = null;
  }
  async getRandomWord(length: number): Promise<string | null> {

    const db = getMongoDatabase();
    if (!db) {
      return null;
    }

    const collection = db.collection('emoter.emotes');
    
        const entry = await collection.aggregate([
          { $match: { strLenCP: length } },
          { $sample: { size: 1 } }
        ]).toArray();

    if (entry.length === 0) {
      return null;
    }
    return entry[0]['_id'];
  }

  async handleInteraction(interaction: CommandInteraction) {
    if (this.winnerWord !== "") {
      await interaction.reply(`There is already a game in progress`);
      return;
    }

    // ensure member is of instance GuildMember
    const member = interaction.member as GuildMember;
    if (!member) {
      await interaction.reply(`You must be in a guild to play`);
      return;
    }

    let wantedLen = interaction.options.getInteger('length');
    if (wantedLen === null) {
      wantedLen = 5;
    }

    this.winnerWord = await this.getRandomWord(wantedLen);
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
          attachment: await this.createPreviewSvg(member),
          name: 'wordle.png'
        }
      ]
    });
  }

  async createPreviewSvg(member: GuildMember) {

    if (this.winnerWord === null) {
      throw new Error('No winner word');
    }

    const width = this.winnerWord.length * dim + (this.winnerWord.length - 1) * gap;
    const height = attempts * dim + (attempts - 1) * gap;

    let svgContent = `<svg width="${width}" height="${height}">`;

    let x = 0;
    let y = 0;

    for (let i = 0; i < attempts; i++) {

      for (let j = 0; j < this.winnerWord.length; j++) {
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

          if (j == this.winnerWord.length - 1 && member) {
            const buffer = (await axios({ url: member.displayAvatarURL(),
              responseType: "arraybuffer" })).data as Buffer;
            
            if (buffer) {
              svgContent += `
                <g>
                  <image
                      x="${x + 10.0}"
                      y="${y}"
                      width="${dim}"
                      height="${dim}"
                      xlink:href="data:image/png;base64,${buffer.toString('base64')}"
                  />
                </g>
              `;
            }

          }
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

const pogle = new Pogle();

export default pogle;