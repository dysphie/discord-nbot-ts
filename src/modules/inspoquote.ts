import axios from "axios";
import { CommandInteraction, MessageAttachment, MessageEmbed } from "discord.js";
import { DatabaseModule } from "../module_mgr";

class InspiroBot extends DatabaseModule {
	
	async commandInspire(interaction: CommandInteraction) {

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply("This command is disabled");
			return;
		}

		const url = "https://inspirobot.me/api?generate=true";
		const quoteUrl = await axios.get(url);
		if (quoteUrl.status !== 200) {
			await interaction.reply({
				content: "Service is currently unavailable",
				ephemeral: true
			});
			return;
		}

		const embed = new MessageEmbed();
		embed.setImage(quoteUrl.data);
		embed.setFooter({
			text: "🧠 Powered by inspirobot.me",
		});
		interaction.reply({ embeds: [embed] });
	}
}

const inspirer = new InspiroBot('inspirobot', 'Posts an AI-generated inspirational quote');

export default inspirer;
