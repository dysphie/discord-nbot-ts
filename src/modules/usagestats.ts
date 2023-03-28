import { CommandInteraction, EmbedBuilder } from 'discord.js';
import { DatabaseModule } from "../module_mgr";

class UsageStats extends DatabaseModule {
	async commandStats(interaction: CommandInteraction) {
		if (!this.isEnabled(interaction.guildId)) {
			await interaction.reply("This command is disabled");
			return;
		}

		const used = process.memoryUsage();
		const cpuUsage = process.cpuUsage();
		const uptime = process.uptime();

		const embed = new EmbedBuilder()
			.setColor('#0099ff')
			.setTitle('Process Stats')
			.addFields(
				{ name: 'Memory Usage', value: `${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB` },
				{ name: 'CPU Usage', value: `${Math.round(cpuUsage.user / 1000)}ms user\n${Math.round(cpuUsage.system / 1000)}ms system`},
				{ name: 'Uptime', value: `${Math.round(uptime)}s` }
			)
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	}
}

const usageStats = new UsageStats('stats', 'Neural network model that can compose music');
export default usageStats;