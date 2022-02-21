"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const discord_js_1 = require("discord.js");
class InspiroBot {
    constructor() {
        console.log("InspiroBot module loaded");
    }
    async handleInteraction(interaction) {
        const url = "https://inspirobot.me/api?generate=true";
        const quoteUrl = await axios_1.default.get(url);
        const att = new discord_js_1.MessageAttachment(quoteUrl.data, "quote.jpg");
        interaction.reply({ files: [att] });
    }
}
const inspirer = new InspiroBot();
exports.default = inspirer;
//# sourceMappingURL=inspoquote.js.map