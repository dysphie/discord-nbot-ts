import { Client, GuildMember, Intents } from "discord.js";
import "dotenv/config";
import animals from "./modules/animals";
import emoter from "./modules/emoter";
import inspirer from "./modules/inspoquote";
import { initMongoDatabase } from "./modules/mongodb";
import nameColorer from "./modules/namecolor";
import adblock from "./modules/patchbot-adblock";
import permathreader from "./modules/permathreads";
import starboard from "./modules/starboard";
import webhookManager from "./modules/utils/webhook_mgr";
import weather from "./modules/weather/weather";
import yeller from "./modules/yeller";
import markdownUrl from "./modules/markdown-url";
import registerCommands from "./register_commands";
import wordle from "./modules/wordle";

// check that nbot_token is set

const token = process.env.NBOT_DISCORD_TOKEN;
if (token === undefined) {
	throw new Error("NBOT_DISCORD_TOKEN is not set");
}

initMongoDatabase();
const client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Intents.FLAGS.GUILD_MEMBERS,
		Intents.FLAGS.GUILD_WEBHOOKS,
		Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
	],
	partials: ["MESSAGE", "REACTION"], // used by starboard on uncached msgs
	allowedMentions: {},
});

client.once("ready", async () => {
	if (client.user == null) {
		throw new Error("Client user is null");
	}

	console.log(`Connected to Discord as ${client.user.tag}`);

	weather.setAssetGuild("759525750201909319");
	emoter.setEmoteGuild("937552002991403132");
	starboard.setStarboardChannel("617539911528218634");
	permathreader.recoverFromSleep(client);
	await registerCommands(client.user.id, token);
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isCommand() || !interaction.channel) {
		return;
	}

	if (!(interaction.member instanceof GuildMember)) {
		return;
	}

	if (interaction.commandName === "weather") {
		await weather.handleInteraction(interaction);
	} else if (interaction.commandName === "namecolor") {
		await nameColorer.handleInteraction(interaction);
	} else if (interaction.commandName === "inspire") {
		await inspirer.handleInteraction(interaction);
	} else if (interaction.commandName == "animal") {
		await animals.handleInteraction(interaction);
	} else if (interaction.commandName == "emoter") {
		await emoter.handleInteraction(interaction);
	} else if (interaction.commandName === "wordle") {
		await wordle.handleInteraction(interaction);
	}
});

client.on("messageReactionAdd", async (reaction) => {
	await starboard.handleReactionUpdate(reaction);
	//await spoiler.handleReactionUpdate(reaction);
});

client.on("messageReactionRemove", async (reaction) => {
	await starboard.handleReactionUpdate(reaction);
	//await spoiler.handleReactionUpdate(reaction);
});

client.on("messageCreate", async (message) => {

	if (message.author.bot) {
		await adblock.handleMessage(message);
		return;
	}

	const emoted = await emoter.handleMessage(message);
	if (!emoted) {
		await yeller.handleMessage(message);
		await markdownUrl.handleMessage(message);
		await wordle.handleMessage(message);
	}
});

client.on("webhookUpdate", async (channel) => {
	await webhookManager.handleWebhookUpdate(channel);
});

client.on("threadUpdate", async (oldThread, newThread) => {
	await permathreader.handleThreadUpdate(newThread);
});

client.login(token);
