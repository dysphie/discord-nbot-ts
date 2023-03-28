import {
	AuditLogEvent,
	BaseGuildTextChannel,
	ForumChannel,
	TextBasedChannelMixin,
	NewsChannel,
	TextChannel,
	ThreadChannel,
	Webhook,
} from "discord.js";

const webhookCache = new Map<string, Webhook>();

class WebhookManager {
	constructor() {
		console.log("WebhookManager module loaded");
	}

	async getWebhookForChannel(channel: TextChannel): Promise<Webhook | undefined>
	{
		const me = channel.client.user;

		let webhook = webhookCache.get(channel.id);
		if (webhook) {
			console.log("Using cached webhook for channel " + channel.id);
		} else {
			console.log("No cached webhook for channel " + channel.id);

			const webhooks = await channel.fetchWebhooks();
			webhook = webhooks.find((w) => w.owner?.id === me?.id);
			if (!webhook) {
				try {
					webhook = await channel.createWebhook({
						name: `${me?.username}`,
						avatar: me?.avatarURL(),
					});
				} catch (e) {
					console.error(e);
				}
			}

			if (webhook) {
				console.log("Caching webhook for channel " + channel.id);
				webhookCache.set(channel.id, webhook);
			}
		}

		return webhook;
	}

	async handleWebhookUpdate(channel: NewsChannel | TextChannel) {
		console.log("Webhook update for channel " + channel.id);

		const auditLogs = await channel.guild.fetchAuditLogs({
			limit: 1,
			type: AuditLogEvent.WebhookDelete ,
		});

		const auditLog = auditLogs.entries.first();
		if (!auditLog) {
			console.log("No webook delete log for channel " + channel.id);
			return;
		}

		const webhook = auditLog.target as Webhook;
		console.log(`${webhookCache.get(channel.id)?.id} == ${webhook.id}`);
		if (webhookCache.get(channel.id)?.id === webhook.id) {
			console.log("Cached webhook was deleted, clearing cache");
			webhookCache.delete(channel.id);
		}
	}
}

const webhookManager = new WebhookManager();

export default webhookManager;
