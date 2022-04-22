import { getMongoDatabase } from './mongodb';


class SettingsManager {

  async getSetting(moduleName: string, channelId: string, settingName: string) {
    const db = getMongoDatabase();
    if (db == null) {
      return null;
    }

    const collection = db.collection(`${moduleName}.settings`);
    const doc = await collection.findOne({ channelId, settingName });
    return doc != null ? doc.value : null;
  }

  async saveSetting(moduleName: string, channelId: string, settingName: string, value: unknown) {
    const db = getMongoDatabase();
    if (db == null) {
      return;
    }

    const collection = db.collection(`${moduleName}.settings`);
    await collection.updateOne({ channelId, settingName }, { $set: { value } });
  }
}

const settings = new SettingsManager();

export default settings;