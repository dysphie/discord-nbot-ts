"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const redirectToThread = {};
class PatchBotAdBlock {
    constructor() {
        console.log("PatchBotAdBlock module loaded");
    }
    async handleMessage(message) {
        if (!message.author.bot || message.author.username !== "PatchBot" ||
            message.embeds.length === 0) {
            return;
        }
        const repostEmbeds = [];
        message.embeds.forEach((embed) => {
            if (!embed.author || embed.author.name.indexOf("This update is brought to you by") === -1) {
                repostEmbeds.push(embed);
            }
        });
        let channel = message.channel;
        if (repostEmbeds.length > 0) {
            const gameName = repostEmbeds[0].author?.name;
            if (gameName) {
                const thread = message.guild?.channels.cache.get(redirectToThread[gameName]);
                if (thread instanceof discord_js_1.ThreadChannel) {
                    channel = thread;
                }
            }
        }
        await channel.send({ embeds: repostEmbeds });
        await message.delete();
    }
}
const adblock = new PatchBotAdBlock();
exports.default = adblock;
//# sourceMappingURL=patchbot-adblock.js.map