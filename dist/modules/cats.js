"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
class RandomAnimal {
    constructor() {
        console.log("RandomAnimal module loaded");
    }
    async handleCat(interaction) {
        const url = 'https://api.thecatapi.com/v1/images/search';
        const resp = await axios_1.default.get(url);
        if (resp.status !== 200) {
            await interaction.reply('Failed to get cat image, all the cats are dead');
            return;
        }
        const imgUrl = resp.data[0].url;
        interaction.reply(imgUrl);
    }
    async handleDog(interaction) {
        const resp = await axios_1.default.get('https://dog.ceo/api/breeds/image/random');
        if (resp.status !== 200) {
            await interaction.reply("Failed to get dog image, all the dogs are dead");
            return;
        }
        const dogUrl = resp.data.message;
        interaction.reply(dogUrl);
    }
    async handleLizard(interaction) {
        const resp = await axios_1.default.get('https://nekos.life/api/v2/img/lizard');
        if (resp.status !== 200) {
            await interaction.reply("Failed to get lizard image, all the lizards are dead");
            return;
        }
        const lizardUrl = resp.data.url;
        interaction.reply(lizardUrl);
    }
}
const randomAnimal = new RandomAnimal();
exports.default = randomAnimal;
//# sourceMappingURL=cats.js.map