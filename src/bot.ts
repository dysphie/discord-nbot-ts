import { Client, ClientOptions, GatewayIntentBits, NewsChannel, Partials, PermissionsBitField, TextChannel } from "discord.js";
import "dotenv/config";
import animals from "./modules/animals";
import { emoter } from "./modules/emoter";
import inspirer from "./modules/inspoquote";
import { initMongoDatabase } from "./mongodb";
import nameColorer from "./modules/namecolor";
import adblock from "./modules/patchbot-adblock";
import permathreader from "./modules/permathreads";
import starboard from "./modules/starboard";
import webhookManager from "./modules/utils/webhook_mgr";
import weather from "./modules/weather/weather";
import yeller from "./modules/yeller";
import markdownUrl from "./modules/markdown-url";
import registerCommands from "./register_commands";
import { DatabaseModule, ModuleManager } from "./module_mgr";
import reminder from "./modules/remindme";
import minidalle from "./modules/minidalle";
import uberduck from "./modules/uberduck";
import { wordleMgr } from "./modules/wordle";
import openaiMgr from "./modules/openai";
import blacklist from "./modules/blacklist";
import composer from "./modules/composer";
import usageStats from "./modules/usagestats";

const token = process.env.NBOT_DISCORD_TOKEN;
if (token === undefined) {
	throw new Error("NBOT_DISCORD_TOKEN is not set");
}

class ModuleBot extends Client {

	moduleMgr: ModuleManager;

	constructor(options: ClientOptions) {
		super(options);

		this.moduleMgr = new ModuleManager();
		this.moduleMgr.registerModule(usageStats);
		this.moduleMgr.registerModule(yeller);
		this.moduleMgr.registerModule(markdownUrl);
		this.moduleMgr.registerModule(wordleMgr);
		this.moduleMgr.registerModule(weather);
		this.moduleMgr.registerModule(animals);
		this.moduleMgr.registerModule(emoter);
		this.moduleMgr.registerModule(inspirer);
		this.moduleMgr.registerModule(nameColorer);
		this.moduleMgr.registerModule(adblock);
		this.moduleMgr.registerModule(permathreader);
		this.moduleMgr.registerModule(starboard);
		this.moduleMgr.registerModule(reminder);
		this.moduleMgr.registerModule(minidalle);
		this.moduleMgr.registerModule(uberduck);
		this.moduleMgr.registerModule(openaiMgr);
		this.moduleMgr.registerModule(blacklist);
		this.moduleMgr.registerModule(composer);
	}
}

const client = new ModuleBot({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions,
		// GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildWebhooks,
		GatewayIntentBits.GuildEmojisAndStickers
	],
	partials: [Partials.Message, Partials.Reaction], // used by starboard on uncached msgs
	allowedMentions: {},
});

client.once("ready", async () => {
	if (client.user == null) {
		throw new Error("Client user is null");
	}

	await initMongoDatabase();

	client.moduleMgr.modules.forEach(async (module: DatabaseModule) => {
		await module.cacheDatabaseData();
	});

	console.log(`Connected to Discord as ${client.user.tag}`);

	await emoter.setupDatabaseIndexes();

	// TODO: Move to config
	weather.setAssetGuild("759525750201909319");
	emoter.setEmoteGuild("937552002991403132");
	permathreader.recoverFromSleep(client);
	reminder.beginRepeatingTask(client);

	await registerCommands(client.user.id, token);
});


client.on("interactionCreate", async (interaction) => {

	if (blacklist.isBlacklisted(interaction.user.id)) {
		return;
	}

	if (interaction.isChatInputCommand()) {
		switch (interaction.commandName) {
			case "weather": {
				weather.commandWeather(interaction);
				break;
			}
			case "emoter": {
				emoter.commandEmote(interaction);
				break;
			}
			case "inspire": {
				inspirer.commandInspire(interaction);
				break;
			}
			case "namecolor": {
				nameColorer.commandNamecolor(interaction);
				break;
			}
			case "animal": {
				animals.commandAnimal(interaction);
				break;
			}
			case "wordle": {
				wordleMgr.commandWordle(interaction);
				break;
			}
			case "module": {
				await client.moduleMgr.commandModule(interaction);
				break
			}
			case "starboard": {
				await starboard.commandSetStarboardChannel(interaction);
				break;
			}
			case "reminder": {
				await reminder.commandRemind(interaction);
				break;
			}

			case "stats": {
				await usageStats.commandStats(interaction);
				break;
			}

			case "imagine": {
				await minidalle.commandCreate(interaction);
				break;
			}

			case "vocalize": {
				await uberduck.commandVocalize(interaction);
				break;
			}

			case "complete": {
				await openaiMgr.commandComplete(interaction);
				break;
			}

			case "compose": {
				await composer.commandCompose(interaction);
				break;
			}
		}
	}
	else if (interaction.isAutocomplete()) {
		switch (interaction.commandName) {
			case "vocalize": {
				await uberduck.commandAutocomplete(interaction);
				break;
			}
		}
	}
});

client.on("messageReactionAdd", async (reaction) => {

	if (reaction.message === null || reaction.message.author === null) {
		return;
	}

	// if (isBlacklisted(reaction.message.author.id)) {
	// 	return;
	// }

	// If an admin reacts to a message of ours with X, delete it
	if (reaction.emoji.name === "❌" &&
		reaction.message.author.id === client.user?.id &&
		reaction.message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
		await reaction.message.delete();
		return;
	}

	await starboard.handleReactionUpdate(reaction);

});

client.on("messageReactionRemove", async (reaction) => {
	await starboard.handleReactionUpdate(reaction);
});

client.on("messageCreate", async (message) => {

	if (blacklist.isBlacklisted(message.author.id)) {
		return;
	}

	if (message.author.bot) {
		await adblock.handleMessage(message);
		return;
	}

	const emoted = await emoter.handleMessage(message);
	if (!emoted) {
		await yeller.handleMessage(message);
		await markdownUrl.handleMessage(message);
		await wordleMgr.handleMessage(message);
	}
});

client.on("webhookUpdate", async (channel) => {
	if (channel instanceof NewsChannel || channel instanceof TextChannel) {
		await webhookManager.handleWebhookUpdate(channel);
	}
});

client.on("threadUpdate", async (oldThread, newThread) => {
	await permathreader.handleThreadUpdate(newThread);
});

client.login(token);
