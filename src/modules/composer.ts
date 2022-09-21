import axios from 'axios';
import { CommandInteraction, MessageAttachment, MessageEmbed } from 'discord.js';
import { DatabaseModule } from "../module_mgr";

class Composer extends DatabaseModule
{
	async compose(style: string, density: string, temp: string)
	{
		const url = 'https://hf.space/embed/ai-guru/composer/task/create';
		
		const resp = axios.post(url, {
			"music_style": style,
			"density": density,
			"temperature": temp
		});

		return resp;
	}

	async commandCompose(interaction: CommandInteraction)
	{
		const style = interaction.options.getString('style');
		const density = interaction.options.getString('density');
		const temp = interaction.options.getString('temperature');

		if (!style || !density || !temp)
		{
			await interaction.reply('Missing arguments');
			return;
		}

		await interaction.deferReply();

		try {
			let resp = await this.compose(style, density, temp);
			const taskId = resp.data['task_id'];

			const MAX_ATTEMPTS = 20;
			let attempts = 0;
			while (attempts++ < MAX_ATTEMPTS) 
			{
				console.log('Attempting compose ' + attempts);
				await new Promise(resolve => setTimeout(resolve, 1000));
				resp = await this.checkTaskStatus(taskId);
				if (resp.data['output'] != null) {
					break;
				}
			}

			const audioStr = resp.data['output']['audio'];

			// get everything after the first comma in base64string
			const base64string = audioStr.substring(audioStr.indexOf(","));

			// convert base64 string to WAV file format
			const buffer = Buffer.from(base64string, 'base64');
			const attachment = new MessageAttachment(buffer, `${style}_${density}_${temp}.wav`);

			await interaction.editReply({ files: [attachment] });
			
		} 
		catch (e) {
			await interaction.editReply({
				content: 'There was an error with your request: ' + e
			});
		}
	}

	async checkTaskStatus(taskId: number)
	{
		const url = `https://hf.space/embed/ai-guru/composer/task/poll?task_id=${taskId}`;
		const resp = await axios.get(url);
		return resp;
	}
}

const composer = new Composer('composer', 'Neural network model that can compose music');
export default composer;