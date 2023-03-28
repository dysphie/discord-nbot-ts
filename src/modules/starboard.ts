import {
	Attachment,
	AttachmentBuilder,
	CommandInteraction,
	EmbedBuilder,
	MessageReaction,
	PartialMessageReaction,
	PermissionsBitField,
	TextChannel,
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

	async getStarboardChannelId(guildId: string | null): Promise<string|null> {
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

		if (!interaction?.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
			await interaction.reply("You must have the Manage Server permission to use this command.");
			return;
		}

		const channel = interaction.options.get("channel")?.channel
		if (!channel) {
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

		let msg = reaction.message;

		if (msg.partial) {
			msg = await msg.fetch();
		}

		// check if reaction is a star or reaction count is above 3
		if (reaction.emoji.name !== "⭐") {
			return;
		}

		if (!this.isEnabled(msg.guildId)) {
			return;
		}

		// check if starboard channel is available and that we are not reacting in the starboard channel
		const starboardChannelId = await this.getStarboardChannelId(msg.guildId);
		if (starboardChannelId === null || msg.channelId === starboardChannelId) {
			return;
		}

		const starboardChannel = msg.guild?.channels.cache.get(starboardChannelId);
		if (starboardChannel === undefined || !(starboardChannel instanceof TextChannel)) {
			return;
		}

		const starredCol = getMongoDatabase()?.collection("starboard.starred");
		if (starredCol === undefined) {
			return;
		}

		const doc = await starredCol.findOne({ msg_id: msg.id, guild: msg.guildId });
		if (doc) {
			// check if message is still in starboard channel
			const message = await starboardChannel.messages.fetch(doc.star_id);
			if (message) {
				if (reaction.count < 1) {
					// remove message from starboard
					await message.delete();
					await starredCol.deleteOne({ msg_id: msg.id, guild: msg.guildId });
					return;
				}

				const newEmbed = EmbedBuilder.from(message.embeds[0]);
				newEmbed.setFooter({
					text: `⭐ ${reaction.count}`
				});

				await message.edit({ embeds: [newEmbed] });
			}
		} else {
			if (reaction.count < 1) {
				return;
			}

			const embed = new EmbedBuilder()
				.setAuthor({
					name: msg.author.tag,
					iconURL: msg.author.displayAvatarURL(),
					url: msg.url,
				})
				.setDescription(msg.content)
				.setTimestamp(msg.createdAt)
				.setFooter({ text: `⭐ ${reaction.count}` });

			// TODO: Include attachments the original message had, if any

			// Check if there's media we should append
			const starred = await starboardChannel.send({
				embeds: [embed],
				//files: newAtts
			});

			starredCol.insertOne({
				msg_id: msg.id,
				star_id: starred.id,
				guild: msg.guildId
			});
		}
	}

}

const starboard = new Starboard('starboard', 'Star messages and have them appear in a starboard channel.');

export default starboard;
