"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVISIBLE_CHAR = exports.getGeodataForLocation = exports.postAsUser = void 0;
const axios_1 = __importDefault(require("axios"));
const webhook_mgr_1 = __importDefault(require("./utils/webhook_mgr"));
const INVISIBLE_CHAR = "\u17B5";
exports.INVISIBLE_CHAR = INVISIBLE_CHAR;
async function postAsUser(channel, member, message) {
    const userNamePadded = member.displayName.padEnd(member.displayName.length + 1, INVISIBLE_CHAR);
    const isThread = channel.isThread();
    const parentChannel = isThread ? channel.parent : channel;
    if (!parentChannel) {
        return false;
    }
    const webhook = await webhook_mgr_1.default.getWebhookForChannel(parentChannel);
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
exports.postAsUser = postAsUser;
async function getGeodataForLocation(location) {
    if (!process.env.NBOT_OPENCAGE_API_KEY) {
        return null;
    }
    // https://opencagedata.com/api#request
    const openCageResp = await axios_1.default.get("https://api.opencagedata.com/geocode/v1/json", {
        params: {
            key: process.env.NBOT_OPENCAGE_API_KEY,
            q: location,
            abbrv: 1,
            limit: 1,
            no_record: 1, // :D
        },
    });
    if (openCageResp.status !== 200) {
        return null;
    }
    return openCageResp.data;
}
exports.getGeodataForLocation = getGeodataForLocation;
//# sourceMappingURL=utils.js.map