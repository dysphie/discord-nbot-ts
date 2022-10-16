import { matchSorter } from "match-sorter";
import {
	Message,
	Guild,
	TextChannel,
	ThreadChannel,
	CommandInteraction,
	GuildEmoji,
	GuildMember,
} from "discord.js";
import { getMongoDatabase } from "../mongodb";
import { isBotOwner, postAsUser } from "../utils";
import { DatabaseModule } from "../module_mgr";

const EMOTER_GUILD_ID = "719448049981849620";
const GLOBAL_GUILD = '0';

// create a cache that's limited to 100 items
// const directLinkCache = new Map<string, string>();

interface DbEmote {
	name: string;
	guild: string;
	uploader: string;
	url: string;
	createdAt: Date;
}

class Emoter extends DatabaseModule {
	cacheGuildId: string;

	constructor(name: string, description: string) {
		super(name, description);
		this.cacheGuildId = "";
	}

	setEmoteGuild(guildId: string) {
		this.cacheGuildId = guildId;
	}

	async setupDatabaseIndexes() {
		
		const emoterCollection = getMongoDatabase()?.collection("emoter.emotes3");
		if (emoterCollection === undefined) {
			return;
		}

		await emoterCollection.createIndex({ guild: 1, name: 1 }, { unique: true });
	}

	async handleMessage(message: Message): Promise<boolean> {
		
		if (message == null || message.guildId === null) {
			return false;
		}

		if (!this.isEnabled(message.guildId)) {
			return false;
		}

		const emotes = getMongoDatabase()?.collection("emoter.emotes3");
		if (emotes === undefined) {
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

		// create list of words prefixed with '$' in message.content, don't include the '$'
		// save non-prefixed words in a variable called nonPrefixedWords
		const prefixed: string[] = [];
		
		const regexMatched = message.content.matchAll(/\$([a-zA-Z0-9]+)/g);

		for (const match of regexMatched) {
			prefixed.push(match[1]);
		}

		prefixed.sort((a,b) => a.length - b.length);

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
			const cursor = emotes.find({ 
				guild: { $in: [GLOBAL_GUILD, message.guildId] },
				name: { $in: prefixed } 
			});

			for await (const doc of cursor) {
				const url = doc.url;
				const name = doc.name.toString();

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

	async tempEmoteFromURL(url: string, name: string, guild: Guild): Promise<GuildEmoji> {
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

	async commandRandom(interaction: CommandInteraction): Promise<void> {
		const db = getMongoDatabase();
		if (db == null) {
			return;
		}

		if (interaction.guild === null) {
			await interaction.reply("This command can only be used in a guild.");
			return;
		}

		const emoterGuild =
			interaction.client.guilds.cache.get(EMOTER_GUILD_ID);
		if (emoterGuild == null) {
			await interaction.reply("This command is unavailable");
			return;
		}

		const emotes = db.collection("emoter.emotes3");

		// get random emote
		const cursor = emotes.aggregate([{ $sample: { size: 1 } }]);
		const doc = await cursor.next();
		if (doc) {
			const url = doc.url;
			const name = doc.name.toString();
			const emote = await this.tempEmoteFromURL(url, name, emoterGuild);
			if (emote) {
				await interaction.reply(`${emote.toString()}`);
			}
		}
	}

	async commandFind(interaction: CommandInteraction) {
		const keyword = interaction.options.getString("keyword");
		if (keyword === null) {
			await interaction.reply("Please specify a keyword.");
			return;
		}

		const db = getMongoDatabase();
		if (db == null) {
			await interaction.reply("Emote search not available at this time");
			return;
		}

		const safeKeyword = keyword.replace(/[^a-zA-Z0-9]/g, "");
		console.log(`Gonna search for ${safeKeyword}`);

		const emotes = db.collection("emoter.emotes3");
		// find all emotes that match the keyword with a limit of 10
		let emoteList = await emotes
			.find({ name: { $regex: `.*${safeKeyword}*.`, $options: "i" } })
			.toArray();
		emoteList = matchSorter(emoteList, keyword, { keys: ["name"] });

		let responseBody = "Top matches: ";
		emoteList.forEach((emote) => {
			const newLine = `[${emote.name}](<${emote.url}>) `;
			// check if adding newLine to responseBody would go over 2000 characters
			if (responseBody.length + newLine.length > 2000) {
				return;
			}
			responseBody += newLine;
		});

		await interaction.reply({
			content: responseBody,
			ephemeral: true,
		});
	}

	// TODO: Why can't we specify return as WithId<Document>|null?
	async getDatabaseEmote(name: string, guildId: string) {

		const emotes = getMongoDatabase()?.collection("emoter.emotes3");
		if (emotes === undefined) {
			return null;
		}

		// find documents where 'guild' field is missing (global emote) or equal to guildId
		const cursor = await emotes.find({
			guild: { $in: [GLOBAL_GUILD, guildId] },
			name: name,
		}).toArray();
		
		const globalEmote = cursor.find((doc) => doc.guildId === null);
		if (globalEmote !== undefined) {
			return globalEmote;
		}

		const localEmote = cursor.find((doc) => doc.guildId === guildId);
		if (localEmote !== undefined) {
			return localEmote;
		}

		return null;
	}

	async commandAdd(interaction: CommandInteraction) {

		if (interaction.guildId === null || !(interaction.member instanceof GuildMember)) {
			await interaction.reply("This command can only be used in a guild.");
			return;
		}

		const url = interaction.options.getString("url");
		if (url === null) {
			await interaction.reply("Please specify a url.");
			return;
		}

		const name = interaction.options.getString("keyword");
		if (name === null) {
			await interaction.reply("Please specify a keyword.");
			return;
		}

		const emotes = getMongoDatabase()?.collection("emoter.emotes3");
		if (emotes === undefined) {
			await interaction.reply("Emote search not available at this time");
			return;
		}

		const emote = await this.getDatabaseEmote(name, interaction.guildId);
		if (emote) {
			await interaction.reply("Emote already exists.");
			return;
		}

		const emoterGuild =
			interaction.client.guilds.cache.get(EMOTER_GUILD_ID);
		if (emoterGuild == null) {
			await interaction.reply("This command is unavailable");
			return;
		}

		let uploadedEmote;
		try {
			uploadedEmote = await this.tempEmoteFromURL(url, name, emoterGuild);
		} catch (e) {
			await interaction.reply(
				`This emote is not compatible with discord. ${e}`
			);
			return;
		}

		if (uploadedEmote) {
			await emotes.insertOne({
				name: name,
				url: uploadedEmote.url,
				uploader: interaction.member.id,
				guild: interaction.guildId
			});

			await interaction.reply(
				`Added emote \`${name}\` ${uploadedEmote.toString()}`
			);
		} else {
			await interaction.reply("Failed to add emote.");
		}
	}

	async commandTest(interaction: CommandInteraction) {

		const emoterGuild = interaction.client.guilds.cache.get(EMOTER_GUILD_ID);
		if (emoterGuild === undefined) {
			await interaction.reply("This command is unavailable");
			return;
		}

		const keyword = interaction.options.getString("keyword");

		// find one in the database
		const db = getMongoDatabase();
		if (db == null) {
			await interaction.reply("Database unavailable");
		} else {
			const emotes = db.collection("emoter.emotes3");
			const cursor = emotes.find({ 
				guild: { $in: [GLOBAL_GUILD, interaction.guildId] },
				name: keyword 
			});
			const doc = await cursor.next();
			if (doc) {
				const url = doc.url;
				const name = doc.name.toString();
				const emote = await this.tempEmoteFromURL(url, name, emoterGuild);
				if (emote) {
					await interaction.reply({
						ephemeral: true,
						content: `${emote.toString()}`,
					});
				}
			}
		}
	}

	async commandDisable(interaction: CommandInteraction) {

		const app = await interaction.client.application?.fetch();
    if (!app || interaction.user.id !== app.owner?.id) {
      await interaction.reply('Only the bot owner can use this command');
      return;
    }

		const keyword = interaction.options.getString("keyword");
		if (keyword === null) {
			await interaction.reply("Please specify a keyword.");
			return;
		}

		const db = getMongoDatabase();
		if (db == null) {
			await interaction.reply("Emote search not available at this time");
			return;
		}

		const emotes = db.collection("emoter.emotes3");
		await emotes.updateOne({ name: keyword },
			{ $set: { disabled: true } });
			
		await interaction.reply(`Disabled emote \`$${keyword}\``);
	}

	async commandEdit(interaction: CommandInteraction) {

		const emotes = getMongoDatabase()?.collection("emoter.emotes3");
		if (emotes === undefined) {
			await interaction.reply("Emote database not available at this time");
			return;
		}

		const keyword = interaction.options.getString("keyword");
		if (keyword === null) {
			await interaction.reply("Please specify a keyword.");
			return;
		}

		const url = interaction.options.getString("url");

		const guildstoSearch = [ interaction.guildId ];
		const uploadersToSearch = [ interaction.user.id ];

		// Admin can edit global emotes
		if (isBotOwner(interaction.user.id)) {
			guildstoSearch.push( GLOBAL_GUILD );

			if (interaction.client.user !== null) {
				uploadersToSearch.push( interaction.client.user.id);
			}
		}
		
		const result = await emotes.updateOne({
			name: keyword,
			uploader: { $in: uploadersToSearch },
			guild: { $in: guildstoSearch }
		}, { $set: { url: url } });

		if (result.modifiedCount === 0) {
			await interaction.reply("You do not own this emote.");
			return;
		}

		// delete from cache guild
		const emoterGuild = interaction.client.guilds.cache.get(EMOTER_GUILD_ID);
		if (emoterGuild !== undefined) {
			const emote = emoterGuild.emojis.cache.find(
				(emote) => emote.name === keyword
			);
			if (emote) {
				emote.delete();
			}
		}
		
		await interaction.reply(`Edited emote \`${keyword}\``);
	}

	async commandEmote(interaction: CommandInteraction) {

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply("This command is disabled");
			return;
		}

		const subCommand = interaction.options.getSubcommand();

		// convert above conditiona to a switch statement
		switch (subCommand) {
			case "random": {
				await this.commandRandom(interaction);
				break;
			}
			case "edit": {
				await this.commandEdit(interaction);
				break;
			}
			// case "remove" {
			// 	await this.commandRemove(interaction);
			// 	break;
			// }
			case "add": {
				await this.commandAdd(interaction);
				break;
			}

			case "test": {
				await this.commandTest(interaction);
				break;
			}
			case "find": {
				await this.commandFind(interaction);
				break;
			}
			default: {
				await interaction.reply({
					content: "Invalid subcommand",
					ephemeral: true,
				});
			}
		}
	}
}

const emoter = new Emoter('emoter', "Allows sending of custom emotes without Nitro");

export { emoter, DbEmote };
