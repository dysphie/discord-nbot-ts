"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
require("dotenv/config");
const animals_1 = __importDefault(require("./modules/animals"));
const emoter_1 = __importDefault(require("./modules/emoter"));
const inspoquote_1 = __importDefault(require("./modules/inspoquote"));
const mongodb_1 = require("./modules/mongodb");
const namecolor_1 = __importDefault(require("./modules/namecolor"));
const patchbot_adblock_1 = __importDefault(require("./modules/patchbot-adblock"));
const permathreads_1 = __importDefault(require("./modules/permathreads"));
const starboard_1 = __importDefault(require("./modules/starboard"));
const webhook_mgr_1 = __importDefault(require("./modules/utils/webhook_mgr"));
const weather_1 = __importDefault(require("./modules/weather/weather"));
const yeller_1 = __importDefault(require("./modules/yeller"));
const register_commands_1 = __importDefault(require("./register_commands"));
// check that nbot_token is set
const token = process.env.NBOT_DISCORD_TOKEN;
if (token === undefined) {
    throw new Error("NBOT_DISCORD_TOKEN is not set");
}
(0, mongodb_1.initMongoDatabase)();
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.Intents.FLAGS.GUILDS,
        discord_js_1.Intents.FLAGS.GUILD_MESSAGES,
        discord_js_1.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        discord_js_1.Intents.FLAGS.GUILD_MEMBERS,
        discord_js_1.Intents.FLAGS.GUILD_WEBHOOKS,
        discord_js_1.Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
    ],
    partials: ["MESSAGE", "REACTION"],
    allowedMentions: {},
});
client.once("ready", async () => {
    if (client.user == null) {
        throw new Error("Client user is null");
    }
    console.log(`Connected to Discord as ${client.user.tag}`);
    weather_1.default.setAssetGuild("759525750201909319");
    emoter_1.default.setEmoteGuild("937552002991403132");
    starboard_1.default.setStarboardChannel("617539911528218634");
    permathreads_1.default.recoverFromSleep(client);
    await (0, register_commands_1.default)(client.user.id, token);
});
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) {
        return;
    }
    if (interaction.commandName === "weather") {
        await weather_1.default.handleInteraction(interaction);
    }
    else if (interaction.commandName === "namecolor") {
        await namecolor_1.default.handleInteraction(interaction);
    }
    else if (interaction.commandName === "inspire") {
        await inspoquote_1.default.handleInteraction(interaction);
    }
    else if (interaction.commandName == "animal") {
        await animals_1.default.handleInteraction(interaction);
    }
    else if (interaction.commandName == "emoter") {
        await emoter_1.default.handleInteraction(interaction);
    }
});
client.on("messageReactionAdd", async (reaction) => {
    await starboard_1.default.handleReactionUpdate(reaction);
});
client.on("messageReactionRemove", async (reaction) => {
    await starboard_1.default.handleReactionUpdate(reaction);
});
client.on("messageCreate", async (message) => {
    if (message.author.bot) {
        await patchbot_adblock_1.default.handleMessage(message);
        return;
    }
    const emoted = await emoter_1.default.handleMessage(message);
    if (!emoted) {
        await yeller_1.default.handleMessage(message);
    }
});
client.on("webhookUpdate", async (channel) => {
    await webhook_mgr_1.default.handleWebhookUpdate(channel);
});
client.on("threadUpdate", async (oldThread, newThread) => {
    await permathreads_1.default.handleThreadUpdate(newThread);
});
client.login(token);
//# sourceMappingURL=bot.js.map