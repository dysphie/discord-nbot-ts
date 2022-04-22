import { GuildMember, Message, TextChannel, ThreadChannel } from "discord.js";
import { DatabaseModule } from "../module_mgr";
import { postAsUser } from "../utils";

class MarkdownUrl extends DatabaseModule {

	async handleMessage(message: Message) {
    if (!this.isEnabled(message.guildId)) {
      return;
    }
    
    // Repost as the bot which can use markdown
    const member = message.member as GuildMember;
    const channel = message.channel as TextChannel | ThreadChannel;
		if (channel && member && message.content.match(/\[(.*?)\]\((.*?)\)/g)) {
      postAsUser(channel, member, message.content);
    }
  }
}

const markdownUrl = new MarkdownUrl('markdown-url', 'Reposts messages with markdown links as the bot');

export default markdownUrl;
