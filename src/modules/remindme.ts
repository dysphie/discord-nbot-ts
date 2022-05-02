import { userMention } from "@discordjs/builders";
import { Client, CommandInteraction, GuildMember, MessageEmbed, TextChannel } from "discord.js";
import { DatabaseModule } from "../module_mgr";
import { getMongoDatabase } from "../mongodb";

class Reminder extends DatabaseModule
{
  async beginRepeatingTask(bot: Client)
  {
    // set interval every 1 minute
    setInterval(async () => {
      this.checkReminders(bot);
    }, 60000);
  }

  // TODO: Optimize DB and API calls
  async checkReminders(bot: Client)
  {
    const reminders = getMongoDatabase()?.collection("reminders");
    if (!reminders) {
      return;
    }

    const remindersToRemove = await reminders.find({ time: { $lt: Date.now() } }).toArray();
    for (const reminder of remindersToRemove) {

      const guild = bot.guilds.cache.get(reminder.guild_id);
      if (guild) {
        const member = await guild.members.fetch(reminder.user_id);
        if (member) {  
          const channel = await guild.channels.fetch(reminder.channel_id);
          if (channel && channel instanceof TextChannel) {
            const embed = new MessageEmbed();
            embed.setTitle("Reminder");
            embed.setDescription(reminder.message);
            embed.setColor("#00ff00");
            await channel.send({
              content: userMention(member.id),
              embeds: [embed]
            });
          }
        }
      }
      
      await reminders.deleteOne({ _id: reminder._id });
    }
  }

  async commandRemind(interaction: CommandInteraction)
  {
    if (!(interaction.member instanceof GuildMember)) {
      return;
    }

    const hours = interaction.options.getNumber("hours");
    const minutes = interaction.options.getNumber("minutes");
    const days = interaction.options.getNumber("days");

    const message = interaction.options.getString("message");

    if (hours === null && minutes === null && days === null)
    {
      await interaction.reply("You must specify a time");
      return;
    }

    let seconds = 0;
    if (hours !== null) {
      seconds += hours * 60 * 60;
    }

    if (minutes !== null) {
      seconds += minutes * 60;
    }

    if (days !== null) {
      seconds += days * 24 * 60 * 60;
    }

    const reminders = getMongoDatabase()?.collection("reminders");
    if (reminders === undefined) {
      await interaction.reply("Internal error, try again later");
      return;
    }

	const remindIn = new Date();
	remindIn.setSeconds(remindIn.getSeconds() + seconds);

    await reminders.insertOne({
      guild_id: interaction.guildId,
      channel_id: interaction.channelId,
      user_id: interaction.member.id,
      message: message,
      time: remindIn
    });

    await interaction.reply(`I will remind you to ${message} in <t:${seconds}:R>`);
  }
}

const reminder = new Reminder('reminder', 'Reminds you of a message in the future');

export default reminder;