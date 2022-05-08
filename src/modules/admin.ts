import { Client } from "discord.js";


// class Admin {

// 	ownerId: string;

// 	constructor(bot: Client) {
// 		this.ownerId = '';
// 	}

// 	async initialize(bot: Client) {
// 		const app = await bot.application?.fetch();

//     	if (app !== undefined && app.owner !== null) {
// 			this.ownerId = app.owner.id;
// 		}
// 	}

// 	async handleReactionUpdate(reaction: MessageReaction | PartialMessageReaction) {
// 		if (reaction.partial) {
// 			reaction = await reaction.fetch();
// 		}

// 		if (reaction.message.partial) {
// 			reaction.message = await reaction.message.fetch();
// 		}

// 		// check if reaction is a star or reaction count is above 3
// 		if (reaction.emoji.name !== "") {
// 			return;
// 		}
// 	}




// }

