"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
class Dogger {
    constructor() {
        console.log("Dogger module loaded");
    }
    async handleInteraction(interaction) {
        let url = '';
        const breed = interaction.options.getString("breed");
        if (!breed) {
            url = 'https://dog.ceo/api/breeds/image/random';
            await interaction.reply("Please select a breed");
            return;
        }
        else {
            url = `https://dog.ceo/api/breed/${breed}/images/random`;
        }
        const resp = await axios_1.default.get(url);
        if (resp.status !== 200) {
            await interaction.reply("Failed to get dog image, all the dogs are dead");
            return;
        }
        const dogUrl = resp.data.message;
        interaction.reply(dogUrl);
    }
}
const dogger = new Dogger();
exports.default = dogger;
//# sourceMappingURL=dogger.js.map