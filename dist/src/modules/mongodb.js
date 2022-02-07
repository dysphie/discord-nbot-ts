"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMongoDatabase = exports.initMongoDatabase = void 0;
const mongodb_1 = require("mongodb");
let mongoClient;
// connect to mongodb
const initMongoDatabase = async () => {
    if (!process.env.NBOT_MONGODB_URI) {
        console.error('NBOT_MONGODB_URI is not set. Database will be unavailable');
        return;
    }
    mongoClient = await mongodb_1.MongoClient.connect(process.env.NBOT_MONGODB_URI);
    // if we fail try again in 5 seconds
    if (!mongoClient) {
        setTimeout(initMongoDatabase, 5000);
        console.log('Failed to connect to mongodb. Retrying in 5 seconds');
    }
    else {
        console.log('Connected to MongoDB');
    }
};
exports.initMongoDatabase = initMongoDatabase;
const getMongoDatabase = () => {
    return mongoClient ? mongoClient.db('nbot') : null;
};
exports.getMongoDatabase = getMongoDatabase;
//# sourceMappingURL=mongodb.js.map