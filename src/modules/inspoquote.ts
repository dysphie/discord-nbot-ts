import axios from "axios";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import { DatabaseModule } from "../module_mgr";

class InspiroBot extends DatabaseModule {
	
	async commandInspire(interaction: CommandInteraction) {

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply("This command is disabled");
			return;
		}

		try {
			const quoteUrl = await axios.get("https://inspirobot.me/api?generate=true");
			const embed = new EmbedBuilder();
			embed.setImage(quoteUrl.data);
			embed.setFooter({
				text: "🧠 Powered by inspirobot.me",
			});
			await interaction.reply({ embeds: [embed] });
		} catch (e) {
			await interaction.reply("Internal error, try again later");
		}
	}
}

const inspirer = new InspiroBot('inspirobot', 'Posts an AI-generated inspirational quote');

export default inspirer;
