import { Message, Embed } from "discord.js";
import { DatabaseModule } from "../module_mgr";

class PatchBotAdBlock extends DatabaseModule {

	async handleMessage(message: Message) {
		if (
			!message.author.bot ||
			message.author.username !== "PatchBot" ||
			message.embeds.length === 0
		) {
			return;
		}

		if (!this.isEnabled(message.guildId)) {
			return;
		}

		const embedsToRepost: Embed[] = [];

		message.embeds.forEach((embed) => {
			if (
				!embed.author ||
				embed.author.name.indexOf(
					"This update is brought to you by"
				) === -1
			) {
				embedsToRepost.push(embed);
			}
		});

		// TODO: Re-add channel redirects

		await message.channel.send({
			embeds: embedsToRepost
		});

		await message.delete();
	}
}

const adblock = new PatchBotAdBlock('patchbot-adblock', 'Blocks PatchBot\'s adverts and redirects updates to the correct channel');

export default adblock;
