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
			await interaction.reply({
				content: "Please provide a prompt.",
				ephemeral: true
			});
			return;
		}

		await interaction.deferReply({
			ephemeral: true,
		});

		await interaction.followUp({
			content: "Imagining your prompt, this can take a while",
			ephemeral: true
		});


		for (let attempts = 0; attempts < 20; attempts++) {
			try {
				const collage = await this.create(prompt);

				//console.log(`Success!`);

				const attachment = new MessageAttachment(collage, "dalle.png");
				const embed = new MessageEmbed();

				embed.setDescription(`"${prompt}" by ${userMention(interaction.user.id)}`);
				embed.setFooter({
					text: "🧠 Powered by DALL·E mini",
				})

				embed.setImage(`attachment://${prompt}.png`);
				await interaction.channel?.send({ embeds: [embed], files: [attachment] });
				break;

			} catch (e) {

				if (attempts >= 20) {
					//console.log(`Dalle: Failed definitely after 20 attempts..`);
					await interaction.followUp({
						content: "Failed to generate image after 20 attempts.",
						ephemeral: true
					});
					break;
				}
				else {
					//console.log(`${e}, retrying in 2 seconds (${attempts})`);
					await new Promise(r => setTimeout(r, 2000));
				}
			}
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
		const composite = await background.composite(parts).png().toBuffer();
		return composite;
	}
}

const minidalle = new MiniDalle('minidalle', 'DALL·E mini is an AI model that generates images from any prompt you give');

export default minidalle;