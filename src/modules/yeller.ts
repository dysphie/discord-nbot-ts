import { Message } from "discord.js";
import { getMongoDatabase } from "../mongodb";
import crypto from "crypto-js";
import { DatabaseModule } from "../module_mgr";

class Yeller extends DatabaseModule {

	constructor(name: string, description: string) 
	{
		super(name, description);
		if (!process.env.NBOT_MONGODB_AES_KEY) {
			console.log("NBOT_MONGODB_AES_KEY not set, yells will be ignored");
		}
	}

	async handleMessage(message: Message) {

		if (message.guildId === null) {
			return;
		}
		
		if (!this.isEnabled(message.guildId)) {
			return;
		}

		if (process.env.NBOT_MONGODB_AES_KEY === undefined) {
			return;
		}


		if (!message.client.user?.id) {
			return;
		}

		let shouldSave = false;
		let shouldYell = false;

		// check for mentions of ourselves
		if (message.mentions.members?.has(message.client.user?.id)) {
			shouldYell = true;
			shouldSave = false;
		} else {
			shouldSave = true;
		}

		// remove everything that isn't a letter or a number, also html tags "<...>"
		const cleanMessage = message.content
			.replace(/<[^>]*>/g, "")
			.replace(/[^a-zA-Z0-9]/g, "");
		const len = cleanMessage.length;

		if (len <= 7) {
			return;
		}

		// iterate every character and count if it's upper or lower case
		let upperCaseCount = 0;
		for (let i = 0; i < len; i++) {
			if (cleanMessage[i] === cleanMessage[i].toUpperCase()) {
				upperCaseCount++;
			}
		}

		const uppercaseRatio = upperCaseCount / len;
		if (uppercaseRatio < 0.85) {
			return;
		}

		shouldYell = true;

		const collection = getMongoDatabase()?.collection("yells");
		if (!collection) {
			return;
		}

		if (shouldYell) {
			const cursor = await collection
				.aggregate([
					{ $match: { guild: message.guildId } },
					{ $sample: { size: 1 } }
				]).toArray();

			if (cursor.length !== 0) {
				const doc = cursor[0];
				let msg;

				// check if doc.m is an AES encrypted string
				if (doc.crypted) {
					msg = crypto.AES.decrypt(
						doc.crypted,
						process.env.NBOT_MONGODB_AES_KEY
					).toString(crypto.enc.Utf8);
				} else {
					msg = doc.m;
				}

				await message.channel.send(msg);
			}
		}

		if (shouldSave) {
			const encrypted = crypto.AES.encrypt(
				message.content,
				process.env.NBOT_MONGODB_AES_KEY
			).toString();

			await collection.insertOne({
				crypted: encrypted,
				author: message.author.id,
				guild: message.guildId,
			});

			//console.log(`Saving yell: ${message.content}`);
		}
	}
}

const yeller = new Yeller('yeller', 'Replies to all-caps messages with a previously sent one');

export default yeller;
