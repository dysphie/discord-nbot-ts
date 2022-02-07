"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
class RandomCat {
    constructor() {
        console.log("RandomCat module loaded");
    }
    async handleInteraction(interaction) {
        const url = 'https://api.thecatapi.com/v1/images/search';
        const resp = await axios_1.default.get(url);
        if (resp.status !== 200) {
            await interaction.reply('Failed to get cat image, all the cats are dead');
            return;
        }
        const imgUrl = resp.data[0].url;
        interaction.reply(imgUrl);
    }
}
const cator = new RandomCat();
exports.default = cator;
//# sourceMappingURL=cats.js.map