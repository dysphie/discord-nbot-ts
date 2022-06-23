import { Client, CommandInteraction, Message } from "discord.js";
import { getMongoDatabase } from "../mongodb";

// This is a joke module to track how many times my friend has changed their profile picture.
// They do it a lot!

class NeyNayer
{
	bot: Client | null = null;
	getStorage()
	{
		return getMongoDatabase()?.collection("neynaypfps");
	}

	async beginTask(bot: Client) {
		console.log("NeyNayer: Started task");
		this.bot = bot;
		await this.checkNayPfp();
		setInterval(async () => {
			await this.checkNayPfp();
		}, /* every 1 hour */ 3600000);
	}

	async commandPfpCount(message: Message) {

		const storage = this.getStorage();
		if (!storage) {
			await message.reply("Could not get storage");
			return;
		}

		await this.checkNayPfp();

		const pfp = await storage.find({}).sort({ date: 1 }).toArray();
		if (!pfp) {
			await message.reply("No profile pic changes detected");
			return;
		}

		const oldest = pfp[0].date;
		const elapsed = new Date().getTime() - oldest;

		// milliseconds to days
		const days = Math.round(elapsed / (1000 * 60 * 60 * 24));

		const count = pfp.length;
		await message.reply(`**${count}** pfp changes detected in **${days}** days`);
	}

	async checkNayPfp()
	{
		console.log('Checking Nays pfp');
		if (!this.bot) {
			//console.log('NeyNayer: Bot not initialized');
			return;
		}

		const nay = await this.bot.users.fetch("142010998239264769");
		if (!nay) {
			console.log("Nay not found");
		}

		const pfpUrl = nay.avatarURL({ format: "png", dynamic: true, size: 1024 });
		//console.log(`Nay pfp: ${pfpUrl}`);
		
		const storage = this.getStorage();
		if (storage === undefined) {
			console.log("Nay pfp storage not found");
			return;
		}

		// save this pfpUrl to the database if it's not already there
		const result = await storage.updateOne({ url: pfpUrl }, { 
			$set: { 
				url: pfpUrl, 
				date: new Date().getTime()
			}
		}, { upsert: true });


		if (result.upsertedCount > 0) {
			console.log(`[${new Date().toLocaleString()}] Nay changed pfp again!`);
		}
	}

}

const neynayer = new NeyNayer();

export default neynayer;
