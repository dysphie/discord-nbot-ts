import { CommandInteraction, Guild, GuildMember, TextChannel } from "discord.js";

interface ValidCommandInteraction extends CommandInteraction {
	member: GuildMember;
	channel: TextChannel;
	guild: Guild;
	guildId: string;
}

export default ValidCommandInteraction;
