import axios from "axios";
import { getMongoDatabase, initMongoDatabase } from "../mongodb"
import dotenv from "dotenv";
dotenv.config();

const MAXLENGTH = 10;
const MINLENGTH = 4;

const main = async () => {

	await initMongoDatabase();

	const dictionaryCol = getMongoDatabase()?.collection("dictionary2");
	if (!dictionaryCol) {
		console.error("Could not get mongo database");
		return;
	}

	// // Drop existing data
	// await dictionaryCol.drop();

	const wordFreqRegex = /^([a-zA-Z]+)\s+([0-9]+)$/;
	// const input = 'viru-ses 1244';

	// // check if input is a word
	// const wordMatch = input.match(wordFreqRegex);
	// console.log(wordMatch);
	// return;
	// create bulk write

	const bulk = dictionaryCol.initializeUnorderedBulkOp();

	const rawData = await axios.get('https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt');
	const lines = rawData.data.split('\n');

	// each line contains a word and a number indicating the frequency of the word
	// we only care about words that are longer than 3 characters
	const wordsOfEachLength = new Array(MAXLENGTH+1-MINLENGTH).fill(0);

	lines.forEach((line: string) => {
		const match = line.match(wordFreqRegex);
		if (match === null) {
			return;
		}

		const word = match[1];
		if (word.length < MINLENGTH || word.length > MAXLENGTH) {
			return;
		}

		const freq = parseInt(match[2]);
		bulk.insert({
			w: word,
			f: freq,
			l: word.length
		});

		wordsOfEachLength[word.length - MINLENGTH]++;
	});

	await bulk.execute();
	wordsOfEachLength.forEach((freq: number, index: number) => {
		console.log(`Inserted ${freq} words of ${index + MINLENGTH} length`);
	});
}

main().catch(console.error);