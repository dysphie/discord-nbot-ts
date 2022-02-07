import axios from "axios";
import { GuildMember, TextChannel, ThreadChannel } from "discord.js";
import webhookManager from "./utils/webhook_mgr";

const INVISIBLE_CHAR = '\u17B5';

async function postAsUser(channel: TextChannel | ThreadChannel, member: GuildMember, message: string): Promise<boolean> {

  const userNamePadded = member.displayName.padEnd(member.displayName.length + 1, INVISIBLE_CHAR);

  const isThread = channel.isThread();
  const parentChannel = isThread ? channel.parent : channel;
  if (!parentChannel) {
    return false;
  }

  const webhook = await webhookManager.getWebhookForChannel(parentChannel);
  if (!webhook) {
    return false;
  }

  try {
    await webhook.send({
      username: userNamePadded,
      content: message,
      avatarURL: member.user.avatarURL() || member.user.defaultAvatarURL,
      threadId: isThread ? channel.id : undefined,
    });
    return true;
  }
  
  catch (e) {
    console.error(e);
    return false;
  }
}

async function getGeodataForLocation(location: string) {

  if (!process.env.NBOT_OPENCAGE_API_KEY) {
    return null;
  }

  // https://opencagedata.com/api#request
  const openCageResp = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
      params: {
          key: process.env.NBOT_OPENCAGE_API_KEY,
          q: location,
          abbrv: 1,
          limit: 1,
          no_record: 1 // :D
      }
  });

  if (openCageResp.status !== 200) {
      return null;
  }

  return openCageResp.data;
}


export { postAsUser, getGeodataForLocation, INVISIBLE_CHAR };