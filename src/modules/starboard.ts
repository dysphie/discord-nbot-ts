import {
	MessageEmbed,
	MessageReaction,
	PartialMessageReaction,
} from "discord.js";
import { getMongoDatabase } from "./mongodb";

class Starboard {
	starboardChannelId = "";

	constructor() {
		console.log("Starboard module loaded");
	}

	setStarboardChannel(channelId: string) {
		this.starboardChannelId = channelId;
	}

	async handleReactionUpdate(
		reaction: MessageReaction | PartialMessageReaction
	) {
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

		// check if starboard channel is available
		const starboardChannel = reaction.message.guild?.channels.cache.get(
			this.starboardChannelId
		);
		if (!starboardChannel || starboardChannel.type !== "GUILD_TEXT") {
			return;
		}

		// check if we have an existing starred message for this message id
		const db = getMongoDatabase();
		if (!db) {
			return;
		}

		const starredCol = db.collection("starboard.starred");

		const msgId = reaction.message.id;

		const doc = await starredCol.findOne({ msg_id: msgId });
		if (doc) {
			// check if message is still in starboard channel
			const message = await starboardChannel.messages.fetch(doc.star_id);
			if (message) {
				if (reaction.count < 1) {
					// remove message from starboard
					await message.delete();
					await starredCol.deleteOne({ msg_id: msgId });
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

			// create objectID from string

			const starred = await starboardChannel.send({ embeds: [embed] });
			starredCol.insertOne({
				msg_id: msgId,
				star_id: starred.id,
			});
		}
	}
}

const starboard = new Starboard();

export default starboard;
