import axios from "axios";
import { OptionalId, Document } from "mongodb";
import { getMongoDatabase, initMongoDatabase } from "../mongodb";
import { config } from "dotenv";
//import { DbEmote } from "../modules/emoter";
config();

interface DbEmote {
  name: string;
  guild: string;
  uploader: string;
  url: string;
  createdAt: Date;
}

const URLS = [
  'https://api.betterttv.net/3/emotes/shared/trending',
  'https://api.betterttv.net/3/emotes/shared/top'
];

const EMOTE_URL_PREPEND = "https://cdn.betterttv.net/emote/";
const EMOTE_URL_APPEND = "/3x";

class BttvImport {
  async downloadFromUrl(url: string): Promise<void> {
    await initMongoDatabase();

    // start a bulk operation in mongodb
    const collection = getMongoDatabase()?.collection('emoter.emotes2');
    if (collection === undefined) {
      console.error("Failed to initialize database");
      return;
    }

    await collection.createIndex({ name: 1 , guild: 1 }, { unique: true });
    process.exit(0);

    // initialize a bulk operation

    // const seenNames = new Set<string>();

    // for (let i = 0; i < 15000; i += 100) {

    //   const resp = await axios.get(url, {
    //     params: { limit: 100, offset: i }
    //   });

    //   if (resp.status !== 200) {
    //     console.error(`Failed to download ${url}. Got status ${resp.status}`);
    //     return;
    //   }

    //   const toInsert: DbEmote[] = [];

    //   resp.data.forEach((entry: any) => {
        
    //     const name = entry.emote.code;
    //     const id = entry.emote.id;

    //     if (name === undefined || id === undefined) {
    //       return;
    //     }

    //     if (seenNames.has(name)) {
    //       console.log(`Ignoring duplicate name ${name}`);
    //       return;
    //     }

    //     let emoteUrl = `${EMOTE_URL_PREPEND}${id}`;
    //     emoteUrl += entry.emote.imageType === 'gif' ? '/3x' : '/2x';

    //     console.log(`Saving emote: ${name}, URL: ${emoteUrl}`);

    //     seenNames.add(name);

    //     // create insert in bulk operation
    //     toInsert.push({
    //       name: name,
    //       url: emoteUrl,
    //       guild: '0',
    //       uploader: '400092409834504212', // FIXME: hardcoded bot id
    //       createdAt: new Date(),
    //     });
    //   });

    //   // execute bulk operation
    //   if (toInsert.length > 0) {
    //     await collection.insertMany(toInsert);
    //   } else {
    //     console.log("Ignoring page with no entries");
    //   }
    // }
  }
}

new BttvImport().downloadFromUrl(URLS[1]).catch(console.error);