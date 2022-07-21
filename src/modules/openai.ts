import { CommandInteraction, MessageEmbed } from "discord.js";
import { Configuration, OpenAIApi } from "openai";
import { DatabaseModule } from "../module_mgr";
import { config } from "dotenv";
import { bold } from "@discordjs/builders";
config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_TOKEN,
});
const openai = new OpenAIApi(configuration);
console.log(`Initialized OpenAI, using token ${process.env.OPENAI_API_TOKEN}`);

class OpenAIManager extends DatabaseModule
{
	async commandComplete(interaction: CommandInteraction)
	{
		let message = interaction.options.getString('prompt');
		if (message === null)
		{
			await interaction.reply({
				content: "Error: No prompt specified",
				ephemeral: true,
			});
			return;
		}

		interaction.deferReply();

		// replace all double spaces with a newline
		message = message.replace(/ {2}/g, "\n");

		const response = await openai.createCompletion({
			model: "text-davinci-002",
			prompt: message,
			temperature: 0.7,
			max_tokens: 256,
			top_p: 1,
			frequency_penalty: 0,
			presence_penalty: 0,
		});

		if (!response || response.data.choices === undefined) {
			await interaction.editReply({
				content: "Error: No response from OpenAI, try a different text!"
			});
			return;
		}

		const autocompleted = response.data.choices[0].text?.substring(0, 2000) || '';
		const content = `${bold(message)}${autocompleted}`;

		const embed = new MessageEmbed();
		embed.setDescription(content);
		embed.setColor(0x3BA55D);
		embed.setFooter({
			text: "🧠 Powered by OpenAI GPT-3",
		})

		await interaction.editReply({
			embeds: [embed],
		});
	}
}

const openaiMgr = new OpenAIManager('OpenAI', 'openai');
export default openaiMgr;
