import { MongoClient } from "mongodb";

let mongoClient: MongoClient;

// connect to mongodb
const initMongoDatabase = async () => {
	if (!process.env.NBOT_MONGODB_URI) {
		console.error(
			"NBOT_MONGODB_URI is not set. Database will be unavailable"
		);
		return;
	}

	mongoClient = await MongoClient.connect(process.env.NBOT_MONGODB_URI);

	// if we fail try again in 5 seconds
	if (!mongoClient) {
		setTimeout(initMongoDatabase, 5000);
		console.log("Failed to connect to mongodb. Retrying in 5 seconds");
	} else {
		console.log("Connected to MongoDB");
	}
};

const getMongoDatabase = () => {
	return mongoClient ? mongoClient.db("nbot") : null;
};

export { initMongoDatabase, getMongoDatabase };
