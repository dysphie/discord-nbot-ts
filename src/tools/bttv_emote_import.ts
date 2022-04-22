// import axios from "axios";
// import { OptionalId, Document } from "mongodb";
// import { getMongoDatabase } from "../mongodb";

// const EMOTE_URL_PREPEND = "https://cdn.betterttv.net/emote/";
// const EMOTE_URL_APPEND = "/3x";

// class BttvImport
// {
//   urls: string[];
  
//   constructor() 
//   {
//     this.urls = [
//       'https://api.betterttv.net/3/emotes/shared/trending',
//       'https://api.betterttv.net/3/emotes/shared/top'
//     ];
//   }

//   async downloadFromUrl(url: string)
//   {
//     // start a bulk operation in mongodb
//     const collection = getMongoDatabase()?.collection('emotes');
//     if (collection === undefined) {
//       console.error("Failed to initialize database");
//       return;
//     }

//     for (let i = 0; i < 15000; i+= 100) {
//     {
//       const resp = await axios.get(url, { 
//         params: { limit: 100, offset: i }
//       });
      
//       if (resp.status !== 200)
//       {
//         console.error(`Failed to download ${url}. Got status ${resp.status}`);
//         return;
//       }
      
//       const toInsert: OptionalId<Document>[] = [];
      
//       resp.data.forEach((entry: any) => {

//         const name = entry.emote.id;
//         const id = entry.emote.id;

//         if (name === undefined || id === undefined) {
//           return;
//         }
        
//         const emoteUrl = `${EMOTE_URL_PREPEND}${id}${EMOTE_URL_APPEND}`;
//         console.log(`Saving emote: ${name}, URL: ${emoteUrl}`);

//         toInsert.push({ name: name, url: emoteUrl, source: 'bttv' });
//       });

//       await collection.insertMany(toInsert);
//     }
//   }
// }

// const bttv = new BttvImport();
// //bttv.downloadFromUrl(bttv.urls[0]).catch(console.error);
