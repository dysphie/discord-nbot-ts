import { bold, spoiler, userMention } from "@discordjs/builders";
import axios from "axios";
import { AutocompleteInteraction, CommandInteraction, MessageAttachment, MessageEmbed } from "discord.js";
import dotenv from "dotenv";
import { DatabaseModule } from "../module_mgr";
import FuzzySearch from 'fuzzy-search';
dotenv.config();

// TODO: Switch to using speak-synchronous

interface CachedVoice {
	displayName: string;
	name: string;
}

class Uberduck extends DatabaseModule {

	voices: CachedVoice[] = [];

	constructor(name: string, description: string) {
		super(name, description);
		this.cacheVoices().catch(console.error);
	}

	buildAuthHeader() {
		const username = process.env.NBOT_UBERDUCK_KEY;
		const password = process.env.NBOT_UBERDUCK_SECRET;
		const auth = "Basic " + Buffer.from(username + ":" + password).toString("base64");

		//console.log(`Creating credentials for ${username} ${password}`);

		return auth;
	}

	async cacheVoices() {

		const resp = await axios.get('https://api.uberduck.ai/voices?mode=tts-basic');

		if (resp.status !== 200) {
			console.error(`Failed to get available voices: ${resp.status}`);
			return;
		}

		resp.data.forEach((voice: { display_name: string; name: string; }) => {
			this.voices.push({ displayName: voice.display_name, name: voice.name });
		});
	}

	async createSpeechRaw(text: string, name: string): Promise<Buffer> {

		const resp = await axios({
			method: 'post',
			responseType: 'arraybuffer',
			url: 'https://api.uberduck.ai/speak-synchronous',
			headers: {
				'Authorization': this.buildAuthHeader(),
			},
			data: {
				speech: text, // text to speak
				voice: name, // voice model
			}
		});

		const buffer = Buffer.from(resp.data, "utf-8");
		return buffer;
	}

	// async createSpeech(text: string, name: string) {

	// 	const resp = await axios({
	// 		method: 'post',
	// 		url: 'https://api.uberduck.ai/speak',
	// 		headers: {
	// 			'Authorization': this.buildAuthHeader(),
	// 		},
	// 		data: {
	// 			speech: text, // text to speak
	// 			voice: name, // voice model
	// 		}
	// 	});

	// 	return resp.data.uuid;
	// }

	// async pollSpeechStatus(speechId: string) {
	// 	const resp = await axios({
	// 		method: 'get',
	// 		url: `https://api.uberduck.ai/speak-status?uuid=${speechId}`,
	// 	});

	// 	return resp.data;
	// }

	async commandVocalize(interaction: CommandInteraction) {
		const text = interaction.options.getString('prompt');
		const name = interaction.options.getString('voice');


		if (text === null || name === null) {
			interaction.reply('Missing arguments!');
			return;
		}

		interaction.reply({
			content: 'Generating speech...',
			ephemeral: true
		});

		//const uuid = await this.createSpeech(text, name);
		// let audioPath = null;

		// const MAX_ATTEMPTS = 20;
		// let attempts = 0;
		// while (audioPath === null && attempts++ < MAX_ATTEMPTS) {
		// 	//console.log('Speech not ready, retrying in 5 seconds..');
		// 	await new Promise(resolve => setTimeout(resolve, 5000));
		// 	const status = await this.pollSpeechStatus(uuid);
		// 	audioPath = status.path;
		// 	//attempts++;
		// }

		try {
			const buffer = await this.createSpeechRaw(text, name);
			const actorName = this.voices.find(voice => voice.name === name)?.displayName ?? 'Unknown';

			const attachment = new MessageAttachment(buffer, "speech.wav");
			const embed = new MessageEmbed();

			const textShort = text.length > 1000 ? text.substring(0, 1000) + '...' : text;
			embed.setDescription(`${bold(actorName)} requested by ${userMention(interaction.user.id)}\n` +
				`Prompt: ${spoiler(textShort)}`);

			embed.setFooter({
				text: "🧠 Powered by Uberduck",
			})

			await interaction.channel?.send({ embeds: [embed], files: [attachment] });
		}
		catch (e) {
			await interaction.followUp({
				content: 'Failed to generate speech!',
				ephemeral: true
			});
			return;
		}
	}

	async commandAutocomplete(interaction: AutocompleteInteraction) {
		const focusedValue = interaction.options.getFocused();
		if (typeof focusedValue !== 'string' || focusedValue.length < 2) {
			await interaction.respond([]);
			return;
		}

		const searcher = new FuzzySearch(this.voices, ['displayName'], {
			caseSensitive: false,
		});

		const results = searcher.search(focusedValue).slice(0, 25);

		await interaction.respond(
			results.map(choice => ({ name: choice.displayName, value: choice.name })),
		);
	}
}

// const dummyStatus = {
// 	started_at: '2022-06-13T00:00:27.884892',
// 	failed_at: null,
// 	finished_at: '2022-06-13T00:00:31.649909',
// 	path: 'https://uberduck-audio-outputs.s3-us-west-2.amazonaws.com/c741b2bd-5f8f-481c-988f-c1a0ccc06309/audio.wav',
// 	meta: null
// }

const uberduck = new Uberduck('uberduck', 'Uberduck');
export default uberduck;