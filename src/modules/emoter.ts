import { matchSorter } from "match-sorter";
import {
	Message,
	Guild,
	TextChannel,
	ThreadChannel,
	CommandInteraction,
	GuildEmoji,
} from "discord.js";
import { getMongoDatabase } from "./mongodb";
import { postAsUser } from "./utils";
import { ObjectId } from "mongodb";
import { Long } from "bson";

const EMOTER_GUILD_ID = "719448049981849620";

// create a cache that's limited to 100 items
// const directLinkCache = new Map<string, string>();

class Emoter {
	cacheGuildId: string;

	constructor() {
		console.log("Emoter module loaded");
		this.cacheGuildId = "";
	}

	setEmoteGuild(guildId: string) {
		this.cacheGuildId = guildId;
	}

	async handleMessage(message: Message): Promise<boolean> {
		if (message == null) {
			return false;
		}

		const db = getMongoDatabase();
		if (db == null) {
			return false;
		}

		const channel = message.channel as TextChannel | ThreadChannel;
		if (channel == null) {
			return false;
		}

		if (!message.member) {
			return false;
		}

		const emoterGuild = message.client.guilds.cache.get(EMOTER_GUILD_ID);
		if (emoterGuild == null) {
			return false;
		}

		let replaced = false;
		const emotes = db.collection("emoter.emotes");

		// create list of words prefixed with '$' in message.content, don't include the '$'
		// save non-prefixed words in a variable called nonPrefixedWords
		const prefixed: string[] = [];

		// split by all whitespace
		let words = message.content.split(/\s+/);
		words = [...new Set(words)];

		words.forEach((word) => {
			if (word.startsWith("$")) {
				prefixed.push(word.substring(1));
			}
		});

		for (let i = prefixed.length - 1; i >= 0; i--) {
			const emote = emoterGuild.emojis.cache.find(
				(emote) => emote.name === prefixed[i]
			);
			if (emote != null) {
				message.content = message.content.replaceAll(
					`$${prefixed[i]}`,
					`${emote.toString()}`
				);
				replaced = true;
				prefixed.splice(i, 1);
			}
		}

		// check if we have prefixed left
		if (prefixed.length !== 0) {
			// find emotes that match the words without the '$'
			const cursor = emotes.find({ _id: { $in: prefixed } });

			for await (const doc of cursor) {
				const url = doc.url;
				const name = doc._id.toString();

				try {
					const emote = await this.tempEmoteFromURL(
						url,
						name,
						emoterGuild
					);
					message.content = message.content.replaceAll(
						`$${name}`,
						`${emote.toString()}`
					);
					replaced = true;
				} catch (err) {
					console.error(
						`Error uploading emote ${name} from ${url}: ${err}`
					);
				}
			}
		}

		if (replaced) {
			postAsUser(channel, message.member, message.content);
			message.delete();
		}

		return replaced;
	}

	async tempEmoteFromURL(
		url: string,
		name: string,
		guild: Guild
	): Promise<GuildEmoji> {
		// Get the oldest emoji in cache, by oldest 'createdTimestamp'
		const cacheSortedByOldest = guild.emojis.cache.sort((a, b) => {
			return a.createdTimestamp - b.createdTimestamp;
		});

		if (cacheSortedByOldest.size >= 45) {
			const emoji = cacheSortedByOldest.first();
			// UNSAFE: assume it will delete gracefully
			emoji?.delete();
			// try {
			// 	console.log(`Deleting emote ${emoji?.name}`);
			// 	await emoji?.delete();
			// } catch (e) {
			// 	console.error(`Error deleting oldest emoji in cache ${emoji?.name}`);
			// }
		}

		const uploadedEmote = await guild.emojis.create(url, name);
		return uploadedEmote;
	}

	async handleRandomEmote(interaction: CommandInteraction): Promise<void> {
		const db = getMongoDatabase();
		if (db == null) {
			return;
		}

		if (interaction.guild === null) {
			interaction.reply("This command can only be used in a guild.");
			return;
		}

		const emoterGuild =
			interaction.client.guilds.cache.get(EMOTER_GUILD_ID);
		if (emoterGuild == null) {
			interaction.reply("This command is unavailable");
			return;
		}

		const emotes = db.collection("emoter.emotes");

		// get random emote
		const cursor = emotes.aggregate([{ $sample: { size: 1 } }]);
		const doc = await cursor.next();
		if (doc) {
			const url = doc.url;
			const name = doc._id.toString();
			const emote = await this.tempEmoteFromURL(url, name, emoterGuild);
			if (emote) {
				interaction.reply(`${emote.toString()}`);
			}
		}
	}

	async handleFindEmote(interaction: CommandInteraction) {
		const keyword = interaction.options.getString("keyword");
		if (keyword === null) {
			interaction.reply("Please specify a keyword.");
			return;
		}

		const db = getMongoDatabase();
		if (db == null) {
			interaction.reply("Emote search not available at this time");
			return;
		}

		const safeKeyword = keyword.replace(/[^a-zA-Z0-9]/g, "");
		console.log(`Gonna search for ${safeKeyword}`);

		const emotes = db.collection("emoter.emotes");
		// find all emotes that match the keyword with a limit of 10
		let emoteList = await emotes
			.find({ _id: { $regex: `.*${safeKeyword}*.`, $options: "i" } })
			.toArray();
		emoteList = matchSorter(emoteList, keyword, { keys: ["_id"] });

		let responseBody = "Top matches: ";
		emoteList.forEach((emote) => {
			const newLine = `[${emote._id}](<${emote.url}>) `;
			// check if adding newLine to responseBody would go over 2000 characters
			if (responseBody.length + newLine.length > 2000) {
				return;
			}
			responseBody += newLine;
		});

		interaction.reply({
			content: responseBody,
			ephemeral: true,
		});
	}

	async handleAddEmote(interaction: CommandInteraction) {
		const url = interaction.options.getString("url");
		if (url === null) {
			interaction.reply("Please specify a url.");
			return;
		}

		const name = interaction.options.getString("keyword");
		if (name === null) {
			interaction.reply("Please specify a keyword.");
			return;
		}

		const db = getMongoDatabase();
		if (db == null) {
			interaction.reply("Emote search not available at this time");
			return;
		}

		if (!interaction.member) {
			interaction.reply("You must be in a guild to use this command.");
			return;
		}

		const emotes = db.collection("emoter.emotes");
		const emote = await emotes.findOne({ _id: name });
		if (emote) {
			interaction.reply("Emote already exists.");
			return;
		}

		const emoterGuild =
			interaction.client.guilds.cache.get(EMOTER_GUILD_ID);
		if (emoterGuild == null) {
			interaction.reply("This command is unavailable");
			return;
		}

		let uploadedEmote;
		try {
			uploadedEmote = await this.tempEmoteFromURL(url, name, emoterGuild);
		} catch (e) {
			interaction.reply(
				`This emote is not compatible with discord. ${e}`
			);
			return;
		}

		if (uploadedEmote) {
			await emotes.insertOne({
				_id: name as unknown as ObjectId,
				url: uploadedEmote.url,
				src: Long.fromString(interaction.member.user.id),
			});

			interaction.reply(
				`Added emote \`${name}\` ${uploadedEmote.toString()}`
			);
		} else {
			interaction.reply("Failed to add emote.");
		}
	}

	async handleTestEmote(interaction: CommandInteraction) {
		const emoterGuild =
			interaction.client.guilds.cache.get(EMOTER_GUILD_ID);
		if (emoterGuild == null) {
			interaction.reply("This command is unavailable");
			return;
		}

		const keyword = interaction.options.getString("keyword");

		// find one in the database
		const db = getMongoDatabase();
		if (db == null) {
			interaction.reply("Database unavailable");
		} else {
			const emotes = db.collection("emoter.emotes");
			const cursor = emotes.find({ _id: keyword });
			const doc = await cursor.next();
			if (doc) {
				const url = doc.url;
				const name = doc._id.toString();
				const emote = await this.tempEmoteFromURL(
					url,
					name,
					emoterGuild
				);
				if (emote) {
					interaction.reply({
						ephemeral: true,
						content: `${emote.toString()}`,
					});
				}
			}
		}
	}

	async handleInteraction(interaction: CommandInteraction) {
		const subCommand = interaction.options.getSubcommand();

		// console.log('Got interaction to handle with subcommand ' + interaction.options.getSubcommand());
		if (subCommand === "random") {
			await this.handleRandomEmote(interaction);
		} else if (subCommand === "edit") {
			await interaction.reply({
				content: "Not implemented yet",
				ephemeral: true,
			});
		} else if (subCommand === "add") {
			await this.handleAddEmote(interaction);
		} else if (subCommand === "remove") {
			await interaction.reply({
				content: "Not implemented yet",
				ephemeral: true,
			});
		} else if (subCommand === "test") {
			await this.handleTestEmote(interaction);
		} else if (subCommand === "find") {
			await this.handleFindEmote(interaction);
		}
	}
}

const emoter = new Emoter();

export default emoter;
