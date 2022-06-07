import axios from "axios";
import { CommandInteraction, MessageAttachment, MessageEmbed } from "discord.js";
import { DatabaseModule } from "../module_mgr";
import { userMention } from "@discordjs/builders";

const API_URL = 'https://bf.dallemini.ai/generate';

class MiniDalle extends DatabaseModule {

	async commandCreate(interaction: CommandInteraction) {

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply("This module is disabled.");
			return;
		}

		const prompt = interaction.options.getString("prompt");
		if (!prompt) {
			await interaction.reply("You must specify a prompt.");
			return;
		}

		await interaction.deferReply();
		await interaction.followUp("Imagining your prompt, this may take upwards of 2 minutes...");

		let buffer = null;
		try {
			buffer = await this.create(prompt);
		} 
		catch (e) {
			await interaction.reply("An error occurred while creating the image.");
			return;
		}

		if (buffer == null) {
			await interaction.reply("An error occurred while creating the image.");
			return;
		}

		const attachment = new MessageAttachment(buffer, "dalle.png");

		const embed = new MessageEmbed();
		embed.setDescription(`"${prompt}" by ${userMention(interaction.user.id)}`);
		embed.setFooter({
			text: "🧠 Powered by DALL·E mini",
		})

		embed.setImage(`attachment://${prompt}.png`);

		await interaction.followUp({ embeds: [embed], files: [attachment] });

	}

	async create(prompt: string): Promise<Buffer|null> {

		const res = await axios.post(API_URL, { prompt: prompt },
			{
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0',
					'Accept': 'application/json',
					'Accept-Language': 'en-US,en;q=0.5',
					'Accept-Encoding': 'gzip, deflate, br',
					'Content-Type': 'application/json',
					'Connection': 'keep-alive'
				}
			})

		if (res.status != 200) {
			console.log(`Painting queue full. Please try again later`);
			return null;
		}

		if (res.data.error || !res.data.images) {
			const e = res.data.error || { error_type: 'API timeout', message: 'API failed to return a response (check !logs for error)' }
			console.log(`[${res.status}] ${e.error_type}: ${e.message}. Please try again later`);
			return null;
		}

		const idx = Math.floor(Math.random() * (res.data.images.length - 1))

		const buffer = Buffer.from(res.data.images[idx], 'base64');
		return buffer;
	}
}

const minidalle = new MiniDalle('minidalle', 'DALL·E mini is an AI model that generates images from any prompt you give');

export default minidalle;