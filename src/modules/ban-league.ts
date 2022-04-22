import { Client, Guild, GuildMember, TextChannel } from "discord.js"
import { DatabaseModule } from "../module_mgr";


class LeagueBan extends DatabaseModule
{
  warnedUsers: string[] = [];
  announceChannelId: string;

  constructor(name: string, description: string) {
    super(name, description);
    this.announceChannelId = '336213135193145344';
  }

  async checkBans(bot: Client) {

    for (const guild of bot.guilds.cache) {

      if (!(guild instanceof Guild)) {
        continue;
      }

      if (!this.isEnabled(guild.id)) {
        continue;
      }

      for (const member of guild.members.cache) {

        if (!(member instanceof GuildMember) || !member.presence) {
          continue;
        }

        if (member.presence.activities.length === 0) {
          continue;
        }

        const activity = member.presence.activities[0];
        if (activity.type !== "PLAYING") {
          continue;
        }

        const game = activity.name;
        if (game.toLowerCase().includes("league of legends")) 
        {
          if (this.warnedUsers.includes(member.id)) {
            continue;
          }
    
          const now = new Date();
          const then = activity.createdAt;
          const diff = now.getTime() - then.getTime();

          if (diff > 1800000) {
            const channel = guild.channels.cache.get(this.announceChannelId);
            if (channel && channel instanceof TextChannel) {
              await channel.send(`${member.displayName} has been warned for playing League of Legends for over 30 minutes.`);
              this.warnedUsers.push(member.id);
            }
          }
        }
      }
    }
  }
}

const leagueban = new LeagueBan('league-warn', 'Warns users for playing League of Legends for over 30 minutes');

export default leagueban;