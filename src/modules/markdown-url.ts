import { GuildMember, Message, TextChannel, ThreadChannel } from "discord.js";
import { postAsUser } from "./utils";

class MarkdownUrl
{
  constructor() {
		console.log("MarkdownUrl module loaded");
	}
  
	async handleMessage(message: Message) {
    // Repost as the bot which can use markdown
    const member = message.member as GuildMember;
    const channel = message.channel as TextChannel | ThreadChannel;
		if (channel && member && message.content.match(/\[(.*?)\]\((.*?)\)/g)) {
      postAsUser(channel, member, message.content);
    }
  }
}

const markdownUrl = new MarkdownUrl();

export default markdownUrl;
