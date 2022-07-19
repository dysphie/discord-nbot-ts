import { userMention } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { DatabaseModule } from "../module_mgr";
import { getMongoDatabase } from "../mongodb";

class Blacklist extends DatabaseModule
{
	blacklistIds: string[] = [];
	
	async cacheBlacklist() {
		const blacklist = await getMongoDatabase()?.collection("blacklist").find({}).toArray();
		if (blacklist) {
			this.blacklistIds = blacklist.map(x => x.user_id);
		} else {
			console.error("Failed to cache blacklist");
		}
	}

	async commandBlacklist(interaction: CommandInteraction) {
		await this.toggleBlacklist(interaction, true);
	}

	async commandUnblacklist(interaction: CommandInteraction) {
		await this.toggleBlacklist(interaction, false);
	}

	async toggleBlacklist(interaction: CommandInteraction, state: boolean) {

		interaction.ephemeral = true;
		const userId = interaction.options.getString('user_id');
		if (!userId) {
			await interaction.reply({
				content: "Please provide a user id to unblacklist",
				ephemeral: true
			});
			return;
		}

		const blacklistCol = getMongoDatabase()?.collection("blacklist");
		if (!blacklistCol) {
			await interaction.reply('Failed to get blacklist. Please try again later.');
			return;
		}

		try {
			if (state) {
				await blacklistCol.updateOne({ user_id: userId }, { $set: { user_id: userId } }, { upsert: true });
				if (!this.blacklistIds.includes(userId)) {
					this.blacklistIds.push(userId);
				}
			} else {
				await blacklistCol.deleteOne({ user_id: userId });
				this.blacklistIds = this.blacklistIds.filter(x => x !== userId);
			}
			await interaction.reply(`${userMention(userId)} has been ${state ? 'blacklisted' : 'unblacklisted'}`);
		}
		catch (e) {
			await interaction.reply(`Failed to update blacklist: ${e}`);
		}
	}

	isBlacklisted(userId: string) {
		return this.blacklistIds.includes(userId);
	}
}

const blacklist = new Blacklist('blacklist', 'Prevents clients from using the bot.');

export default blacklist;