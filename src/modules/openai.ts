import { CommandInteraction, TextBasedChannel, MessageActionRow, MessageButton, MessageComponentInteraction, MessageEmbed } from "discord.js";
import { Configuration, OpenAIApi } from "openai";
import { DatabaseModule } from "../module_mgr";
import { config } from "dotenv";
import { bold, inlineCode, userMention } from "@discordjs/builders";
import { MAX_MESSAGE_LENGTH } from "../utils";
import { MessageButtonStyles } from "discord.js/typings/enums";
config();

const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_TOKEN,
});
const openai = new OpenAIApi(configuration);
console.log(`Initialized OpenAI, using token ${process.env.OPENAI_API_TOKEN}`);

class OpenAIManager extends DatabaseModule {
	async commandComplete(interaction: CommandInteraction) {
		if (!interaction.channel) {
			return;
		}

		let prompt = interaction.options.getString('prompt');
		interaction.ephemeral = true;

		if (!prompt) {
			await interaction.reply("Error: No prompt specified");
			return;
		}

		prompt = prompt.replace(/ {2}/g, "\n");
		prompt = prompt.replace(/\*\*/g, '');
		
		if (prompt.length > MAX_MESSAGE_LENGTH || prompt.length < 1) {
			await interaction.reply("Error: Prompt is too long or too short!");
			return;
		}

		await interaction.deferReply();
		const embed = await this.createResponseEmbed(prompt);
		const controls = await this.createControls(interaction.channel, interaction.user.id);
		await interaction.editReply({
			embeds: [embed],
			components: [controls],
		});
	}

	async createControls(channel: TextBasedChannel, userId: string): Promise<MessageActionRow> {

		const buttons = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('reroll')
					.setLabel('Reroll')
					.setStyle(MessageButtonStyles.SECONDARY),
				new MessageButton()
					.setCustomId('publish')
					.setLabel('Publish')
					.setStyle(MessageButtonStyles.PRIMARY)
			);
		
		const filter = (i: { user: { id: string; }; }) => i.user.id === userId;
		const collector = channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

		collector.on('collect', async (btnInteract: MessageComponentInteraction) => {
			
			//console.log(`Collector got button`);
			collector.stop();

			if (btnInteract.customId === 'reroll' && btnInteract.channel) {
				await this.buttonReroll(btnInteract);
			}
			else if (btnInteract.customId === 'publish') {
				await this.buttonPublish(btnInteract);
			}
		});

		return buttons;
	}

	async buttonReroll(interaction: MessageComponentInteraction) {
		
		if (!interaction.channel) {
			return;
		}

		// HACK: This is a hack to get the original prompt
		// It only works if we stripped '**' from user input earlier
		const content = interaction.message.embeds[0].description || '';
		const start = content.indexOf('**') + 2;
		const end = content.indexOf('**', start);
		const prompt = content.substring(start, end);

		//console.log(`Rerolling prompt: ${prompt}`);

		await interaction.deferUpdate();
		const embed = await this.createResponseEmbed(prompt);
		const controls = await this.createControls(interaction.channel, interaction.user.id);
		await interaction.editReply({
			embeds: [embed],
			components: [controls],
		});
	}

	async buttonPublish(interaction: MessageComponentInteraction) {
		
		if (!interaction.channel) {
			return;
		}

		// Copy the embed
		const embed = interaction.message.embeds[0] as MessageEmbed;
		// embed.setFooter({
		// 	text: "🧠 Powered by OpenAI GPT-3",
		// });

		await interaction.channel.send({
			content: `${userMention(interaction.user.id)} used ${inlineCode('/complete')}`,
			embeds: [embed],
		})

		await interaction.deferUpdate();
		// get message this button belongs to and delete it
		await interaction.deleteReply();

	}

	async createResponseEmbed(prompt: string) {

		const embed = new MessageEmbed();
		
		// const randomNumber = Math.floor(Math.random() * 100);
		// embed.setDescription(`${randomNumber}`);
		// return embed;

		let autocompleted = '\nNo response from OpenAI';
		embed.setColor(0xFF0000);

		try {
			const response = await openai.createCompletion({
				model: "text-davinci-002",
				prompt: prompt,
				temperature: 0.9,
				max_tokens: 256,
				top_p: 1,
				frequency_penalty: 0,
				presence_penalty: 0,
			});

			if (response.data.choices) {
				autocompleted = response.data.choices[0].text?.substring(0, MAX_MESSAGE_LENGTH) || '';
				embed.setColor(0x5865F2);
			}
		}
		catch (e) {
			console.log(`OpenAI error: ${e}`);
		}

		embed.setDescription(`${bold(prompt)}${autocompleted}`);

		return embed;
	}
}

const openaiMgr = new OpenAIManager('OpenAI', 'openai');
export default openaiMgr;

