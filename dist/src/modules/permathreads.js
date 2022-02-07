"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../config"));
class Permathreader {
    isPermathread(thread) {
        return config_1.default.permathreads.includes(thread.id);
    }
    async recoverFromSleep(client) {
        console.log(`Recovering permathreads...`);
        if (client == null || config_1.default.permathreads.length <= 0) {
            console.log("Nothing to recover is there");
            return;
        }
        for (const [, guild] of client.guilds.cache) {
            for (const [, channel] of guild.channels.cache) {
                if (!(channel instanceof discord_js_1.TextChannel)) {
                    continue;
                }
                const fetched = await channel.threads.fetchArchived();
                for (const [, thread] of fetched.threads) {
                    if (thread.archived && this.isPermathread(thread)) {
                        console.log(`Recovered permathread ${thread.name}`);
                        await thread.setArchived(false);
                    }
                }
            }
        }
    }
    async handleThreadUpdate(newThread) {
        if (newThread.archived && this.isPermathread(newThread)) {
            console.log(`Preventing ${newThread.name} from archiving`);
            await newThread.setArchived(false);
        }
    }
    async handleInteraction(interaction) {
        const threadName = interaction.options.getString("name");
        if (!threadName) {
            interaction.reply("Must specify thread name");
            return;
        }
        if (interaction.channel instanceof discord_js_1.TextChannel) {
            try {
                const thread = await interaction.channel.threads.create({
                    name: threadName,
                    autoArchiveDuration: 1440,
                    reason: threadName,
                });
                config_1.default.permathreads.concat(thread.id);
                await interaction.reply("Created permathread");
            }
            catch (e) {
                await interaction.reply(`Failed to create permathread: ${e}`);
            }
        }
    }
}
const permathreader = new Permathreader();
exports.default = permathreader;
//# sourceMappingURL=permathreads.js.map