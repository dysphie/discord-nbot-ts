import axios from "axios";
import { CommandInteraction, MessageAttachment, MessageEmbed } from "discord.js";
import { DatabaseModule } from "../module_mgr";
import { userMention } from "@discordjs/builders";
import sharp from "sharp";

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

		try {
			const buffer = await this.create(prompt);
			const attachment = new MessageAttachment(buffer, "dalle.png");
			const embed = new MessageEmbed();

			embed.setDescription(`"${prompt}" by ${userMention(interaction.user.id)}`);
			embed.setFooter({
				text: "🧠 Powered by DALL·E mini",
			})

			embed.setImage(`attachment://${prompt}.png`);
			await interaction.followUp({ embeds: [embed], files: [attachment] });
		}
		catch (e) 
		{
			await interaction.followUp(`Image queue full, try again later`);
			return;
		}
	}

	async create(prompt: string): Promise<Buffer> {

		const res = await axios.post(API_URL, { prompt: prompt }, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0',
				'Accept': 'application/json',
				'Accept-Language': 'en-US,en;q=0.5',
				'Accept-Encoding': 'gzip, deflate, br',
				'Content-Type': 'application/json',
				'Connection': 'keep-alive'
			}
		});

		const parts = [
			{ input: Buffer.from(res.data.images[0], 'base64'), gravity: 'northwest' },
			{ input: Buffer.from(res.data.images[1], 'base64'), gravity: 'north' },
			{ input: Buffer.from(res.data.images[2], 'base64'), gravity: 'northeast' },
			{ input: Buffer.from(res.data.images[3], 'base64'), gravity: 'west' },
			{ input: Buffer.from(res.data.images[4], 'base64'), gravity: 'center' },
			{ input: Buffer.from(res.data.images[5], 'base64'), gravity: 'east' },
			{ input: Buffer.from(res.data.images[6], 'base64'), gravity: 'southwest' },
			{ input: Buffer.from(res.data.images[7], 'base64'), gravity: 'south' },
			{ input: Buffer.from(res.data.images[8], 'base64'), gravity: 'southeast' },
		]

		const background = sharp({
			create: {
				width: 768,
				height: 768,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 1.0 }
			}
		})

		// // merge all the images
		const composite = await background.composite(parts).jpeg().toBuffer();
		return composite;
	}
}

const minidalle = new MiniDalle('minidalle', 'DALL·E mini is an AI model that generates images from any prompt you give');

export default minidalle;