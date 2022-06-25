import axios from "axios";
import { CommandInteraction } from "discord.js";
import { DatabaseModule } from "../module_mgr";

class RandomAnimal extends DatabaseModule {

	async commandCat(interaction: CommandInteraction) {
		try {
			const resp = await axios.get("https://api.thecatapi.com/v1/images/search");
			const imgUrl = resp.data[0].url;
			await interaction.reply(imgUrl);
		} catch (e) {
			await interaction.reply("Internal error, try again later");
		}
	}

	async commandDog(interaction: CommandInteraction) {

		try {
			const resp = await axios.get("https://dog.ceo/api/breeds/image/random");
			const dogUrl = resp.data.message;
			await interaction.reply(dogUrl);
		} catch (e) {
			await interaction.reply("Internal error, try again later");
		}
	}

	async commandLizard(interaction: CommandInteraction) {
		try {
			const resp = await axios.get("https://nekos.life/api/v2/img/lizard");
			const lizardUrl = resp.data.url;
			await interaction.reply(lizardUrl);
		} catch (e) {
			await interaction.reply("Internal error, try again later");
		}
	}

	async commandAnimal(interaction: CommandInteraction) {

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply("This command is disabled");
			return;
		}

		const option = interaction.options.getString("species");
		switch (option) {
			case "dog":
				await this.commandDog(interaction);
				break;
			case "cat":
				await this.commandCat(interaction);
				break;
			case "lizard":
				await this.commandLizard(interaction);
				break;
			default:
				await interaction.reply(`Unknown animal ${option}`);
				break;
		}
	}
}

const animals = new RandomAnimal('animals', 'Posts various random animals');

export default animals;
