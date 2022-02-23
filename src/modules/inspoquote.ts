import axios from "axios";
import { CommandInteraction, MessageAttachment } from "discord.js";

class InspiroBot {
	constructor() {
		console.log("InspiroBot module loaded");
	}

	async handleInteraction(interaction: CommandInteraction) {
		const url = "https://inspirobot.me/api?generate=true";
		const quoteUrl = await axios.get(url);
		if (quoteUrl.status !== 200) {
			await interaction.reply({
				content: "Service is currently unavailable",
				ephemeral: true
			});
			return;
		}
		const att = new MessageAttachment(quoteUrl.data, "quote.jpg");
		interaction.reply({ files: [att] });
	}
}

const inspirer = new InspiroBot();

export default inspirer;
