import { userMention } from "@discordjs/builders";
import { Client, CommandInteraction, Guild, GuildMember, Message, MessageActionRow, MessageButton, TextChannel, User } from "discord.js";
import Markov, { MarkovGenerateOptions, MarkovImportExport } from "markov-strings";
import { GridFSBucket } from "mongodb";
import { DatabaseModule } from "../module_mgr";
import { getMongoDatabase } from "../mongodb";
import { postAsUser } from "../utils";



class Markovify extends DatabaseModule {

	async doConfirmation(interaction: CommandInteraction) {

		if (!interaction.channel || !interaction.guild) {
			return false;
		}

		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('deny')
					.setLabel('Deny')
					.setStyle('DANGER'),
				new MessageButton()
					.setCustomId('accept')
					.setLabel('Accept')
					.setStyle('SUCCESS')
			);

		const msg = "Simulating your speech requires building a speech model. \n" +
			"This involves collecting all of your previously sent messages. \n" +
			"Messages from private and/or NSFW channels are not collected. \n" +
			"The resulting data can be deleted at any time via `/mimic_optout` \n"
		"Are you sure you want to continue?";

		const filter = (i: { user: { id: string; }; }) => i.user.id === interaction.user.id;

		const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

		await interaction.reply({
			content: msg,
			components: [row]
		});
		
		console.log('Creating collector');
		collector.on('collect', async button => {

			if (button.customId === 'deny') {
				await button.reply('Operation cancelled');
			} else if (button.customId === 'accept' && button.guild) {
				await button.reply('Creating markov model... This might take a while');
				await this.createSpeechModel(button.user, button.guild);
				await button.followUp('Markov model created, do `/mimic` again');
			}
			}
		);
	}

	async createSpeechModel(user: User, guild: Guild): Promise<Markov | null> {

		const db = getMongoDatabase();
		if (!db) {
			return null;
		}

		const messages: string[] = [];


		for (const channel of guild.channels.cache.values()) {

			if (!(channel instanceof TextChannel) || channel.nsfw) {
				continue;
			}

			// check if @everyone can see the channel
			if (!channel.permissionsFor(guild.roles.everyone).has('VIEW_CHANNEL')) {
				continue;
			}

			let message = await channel.messages
				.fetch({ limit: 1 })
				.then(messagePage => (messagePage.size === 1 ? messagePage.at(0) : null));

			console.log(`Fetching messages..`);
			while (message) {
				const messagePage = await channel.messages.fetch({ limit: 100, before: message.id });

				// for each message in messagePage, if message author is user, add to messages
				for (const msg of messagePage.values()) {
					if (msg.author.id === user.id) {
						messages.push(msg.content);
					}
				}
				message = 0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
			}
			console.log(`Fetched ${messages.length} messages`);
		}

		// Build the Markov generator
		const markov = new Markov({ stateSize: 2 })

		markov.addData(messages);

		// save to mongo db FS grid
		const exported = markov.export();
		const serialized = JSON.stringify(exported);
		const buffer = Buffer.from(serialized);

		const fileName = this.formatMarkovFilename(user, guild);
		const bucket = new GridFSBucket(db, { bucketName: 'markov' });
		const uploadStream = bucket.openUploadStream(fileName);
		uploadStream.end(buffer);

		console.log(`Created markov model: ${fileName} from ${messages.length} messages`);
		return markov;
	}

	async getMarkovForUser(user: User, guild: Guild): Promise<null | Markov> {

		const db = getMongoDatabase();
		if (db === null) {
			return null;
		}

		const fileName = this.formatMarkovFilename(user, guild);
		const bucket = new GridFSBucket(db, { bucketName: 'markov' });

		// Check if we already have a markov model for this user
		const files = await bucket.find({ filename: fileName }, { limit: 1 }).toArray();

		// Check if the model is more than a month old
		if (files.length === 0) {
			return null;
		}

		const downloadStream = bucket.openDownloadStreamByName(fileName);
		const buffer: Buffer = await new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			downloadStream.on('data', chunk => chunks.push(chunk));
			downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
			downloadStream.on('error', err => reject(err));
		});

		const markov = new Markov();
		const importedstr = buffer.toString();
		markov.import(JSON.parse(importedstr));
		return markov;
	}

	formatMarkovFilename(user: User, guild: Guild): string {
		return `${user.id}_${guild.id}.txt`;
	}

	async commandMimic(interaction: CommandInteraction) {

		if (!(interaction.channel instanceof TextChannel)) {
			return;
		}

		if (!(interaction.member instanceof GuildMember)) {
			return;
		}

		if (interaction.channel === null || interaction.guild === null) {
			return;
		}

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply('Markov is not enabled on this server.');
			return;
		}

		let target = interaction.options.getUser("user");
		if (target === null) {
			target = interaction.user; // use author
		}

		const markov = await this.getMarkovForUser(target, interaction.guild);
		
		if (markov === null) {

			

			// We don't have a markov chain for this user
			// If the user is the command issuer, ask if they want to create one
			// Otherwise just say we don't have one

			if (target.id !== interaction.user.id) 
			{
				await interaction.reply(`${target.username} hasn't opted into mimic on this server.`);
				return;
			}
			else 
			{
				await this.doConfirmation(interaction);
				return;
			}
		}
		else {
			console.log(`Using existing markov model for ${target.username}`);
		}

		if (markov !== null) {

			const resp = await interaction.reply({
				content: `Mimicking ${target.username}...`,
				fetchReply: true
			});

			if (resp instanceof Message) {
				await resp.delete();
			}
			
			for (let i = 0; i < 3; i++) {

				const sentence = markov.generate({
					maxTries: 100,
					prng: Math.random
				});

				if (sentence === undefined)
				{
					await interaction.channel.send("Failed to generate a sentence. Not enough data.");
					break;
				}
				else {
					await postAsUser(interaction.channel, interaction.member, sentence.string, ' Simulator');
				}
			}
		}
	}

	async commandOptout(interaction: CommandInteraction) {

		if (interaction.channel === null || interaction.guild === null) {
			return;
		}

		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply('Markov is not enabled on this server.');
			return;
		}

		let target = interaction.options.getUser("user");
		if (target === null) {
			target = interaction.user; // use author
		}

		const db = getMongoDatabase();
		if (db === null) {
			return;
		}

		const fileName = this.formatMarkovFilename(target, interaction.guild);
		const bucket = new GridFSBucket(db, { bucketName: 'markov' });

		// Check if we already have a markov model for this user
		const files = await bucket.find({ filename: fileName }).toArray();

		for (const file of files) {
			await bucket.delete(file._id);
		}

		await interaction.reply(`Deleted ${files.length} markov models for ${target.username}`);
	}
}

const markovify = new Markovify('mimic', 'Mimics users speech');

export default markovify;