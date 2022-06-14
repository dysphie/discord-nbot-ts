import axios from "axios";
import { getMongoDatabase, initMongoDatabase } from "../mongodb";
import { config } from "dotenv";
config();

interface DbEmote {
	name: string;
	guild: string;
	uploader: string;
	url: string;
	createdAt: Date;
	source: string;
}

const URLS = [
	'https://api.betterttv.net/3/emotes/shared/top',
	'https://api.betterttv.net/3/emotes/shared/trending'
];

const EMOTE_URL_PREPEND = "https://cdn.betterttv.net/emote/";

class BttvImport {

	async beginImport(url: string): Promise<void> {

		await initMongoDatabase();

		// start a bulk operation in mongodb
		const collection = getMongoDatabase()?.collection('emoter.emotes3');
		if (collection === undefined) {
			console.error("Failed to initialize database");
			return;
		}

		// Holds the most uses for a given emote keyword
		const mostUses = new Map();

		for (let i = 0; i < 15000; i += 100) {

			const resp = await axios.get(url, {
				params: { limit: 100, offset: i }
			});

			if (resp.status !== 200) {
				console.error(`Failed to download ${url}. Got status ${resp.status}`);
				return;
			}

			const toInsert: DbEmote[] = [];

			resp.data.forEach((entry: any) => {

				const name = entry.emote.code;
				const id = entry.emote.id;
				const uses = entry.total;

				if (name === undefined || id === undefined || uses === undefined) {
					console.log(`🔴 Ignoring '${name}' with undefined name or id`);
					return;
				}

				// Ignore this emote if a more popular version of it already exists
				const topUses = mostUses.get(name);
				if (topUses !== undefined && topUses > uses) {
					console.log(`🟡 Ignoring '${name}' (${uses} < ${topUses})`);
					return;
				}

				let emoteUrl = `${EMOTE_URL_PREPEND}${id}`;

				emoteUrl += entry.emote.imageType === 'gif' ? '/3x' : '/2x';

				console.log(`🟢 Adding '${name}' with ${uses} uses`);

				mostUses.set(name, uses);

				// create insert in bulk operation
				toInsert.push({
					name: name,
					url: emoteUrl,
					guild: '0',
					uploader: '400092409834504212', // FIXME: hardcoded bot id
					createdAt: new Date(),
					source: 'bttv'
				});
			});

			if (toInsert.length > 0) {
				await collection.insertMany(toInsert);
			}
		}

		console.log('Finished');
	}
}

const main = async () => {
	const importer = new BttvImport();
	for (const url of URLS) {
		await importer.beginImport(url);
	}
}

main().catch(console.error);