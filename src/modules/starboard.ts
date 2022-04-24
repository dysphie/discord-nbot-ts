import {
	CommandInteraction,
	MessageEmbed,
	MessageReaction,
	PartialMessageReaction,
} from "discord.js";
import { DatabaseModule } from "../module_mgr";
import { getMongoDatabase } from "../mongodb";

class Starboard extends DatabaseModule {


	async setStarboardChannel(channelId: string, guildId: string) {

		const starboardCol = getMongoDatabase()?.collection("starboard.channels");
		if (starboardCol === undefined) {
			return;
		}
		
		await starboardCol.updateOne(
			{ guild: guildId },
			{ $set: { channel: channelId } },
			{ upsert: true }
		);
	}

	async getStarboardChannel(guildId: string | null) {
		const db = getMongoDatabase();
		if (!db) {
			return null;
		}

		const starboardCol = db.collection("starboard.channels");
		const doc = await starboardCol.findOne({ guild: guildId });
		return doc?.channel;
	}

	async commandSetStarboardChannel(interaction: CommandInteraction) {

		if (!interaction.guildId) {
			await interaction.reply("This command can only be used in a server.");
			return;
		}

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply("Starboard is not enabled in this server.");
			return;
		}

		const channel = interaction.options.getChannel("channel");
		if (channel === null) {
			await interaction.reply("You must specify a channel");
			return;
		}

		await this.setStarboardChannel(channel.id, interaction.guildId);
		await interaction.reply(`Starboard channel set to ${channel.toString()}`);
	}

	async handleReactionUpdate(reaction: MessageReaction | PartialMessageReaction) {
		if (reaction.partial) {
			reaction = await reaction.fetch();
		}

		if (reaction.message.partial) {
			reaction.message = await reaction.message.fetch();
		}

		// check if reaction is a star or reaction count is above 3
		if (reaction.emoji.name !== "⭐") {
			return;
		}

		if (!this.isEnabled(reaction.message.guildId)) {
			return;
		}

		// check if starboard channel is available
		const starboardChannel = await this.getStarboardChannel(reaction.message.guildId);
		if (starboardChannel === null) {
			return;
		}

		const starredCol = getMongoDatabase()?.collection("starboard.starred");
		if (starredCol === undefined) {
			return;
		}

		const msgId = reaction.message.id;

		const doc = await starredCol.findOne({ msg_id: msgId, guild: reaction.message.guildId });
		if (doc) {
			// check if message is still in starboard channel
			const message = await starboardChannel.messages.fetch(doc.star_id);
			if (message) {
				if (reaction.count < 1) {
					// remove message from starboard
					await message.delete();
					await starredCol.deleteOne({ msg_id: msgId, guild: reaction.message.guildId });
					return;
				}

				const embed = message.embeds[0];
				if (embed) {
					embed.footer = {
						text: `⭐ ${reaction.count}`,
					};
					await message.edit({ embeds: [embed] });
				}
			}
		} else {
			if (reaction.count < 1) {
				return;
			}

			const embed = new MessageEmbed()
				.setAuthor({
					name: reaction.message.author.tag,
					iconURL: reaction.message.author.displayAvatarURL(),
					url: reaction.message.url,
				})
				.setDescription(reaction.message.content)
				.setTimestamp(reaction.message.createdAt)
				.setFooter({ text: `⭐ ${reaction.count}` });


			const starred = await starboardChannel.send({ embeds: [embed] });
			starredCol.insertOne({
				msg_id: msgId,
				star_id: starred.id,
				guild: reaction.message.guildId
			});
		}
	}

}

const starboard = new Starboard('starboard', 'Star messages and have them appear in a starboard channel.');

export default starboard;
