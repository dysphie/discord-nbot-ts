import axios from 'axios';
import { load } from 'cheerio';
import { CommandInteraction } from 'discord.js';
import { Text } from 'domhandler';
import { DatabaseModule } from '../module_mgr';
import { getMongoDatabase } from '../mongodb';

const WORKSHOP_HOME = "https://steamcommunity.com/workshop/browse/?appid=224260&browsesort=mostrecent&section=readytouseitems&requiredtags%5B0%5D=Objective+Maps&created_date_range_filter_start=0&created_date_range_filter_end=0&updated_date_range_filter_start=0&updated_date_range_filter_end=0&actualsort=mostrecent&p=1";
const WORKSHOP_FILE = "https://steamcommunity.com/sharedfiles/filedetails/?id=";

class WorkshopIterator extends DatabaseModule
{
    lastAnnouncedId: string = '-1';
    itemIds: string[] = [];

    async commandSetAnnouncementChannel(interaction: CommandInteraction)
    {
        if (interaction.guildId === null) {
            await interaction.reply("This command can only be used in a server.");
            return;
        }

        const channel = interaction.options.getChannel('channel');
        if (channel === null)
        {
            await interaction.reply("You must specify a channel to announce to.");
            return;
        }

        await getMongoDatabase()?.collection('config').updateOne({
            guild: interaction.guildId,
        }, { $set: { channel: channel.id } }, { upsert: true });
        await interaction.reply("Announcement channel set to " + channel.name);
    }

    async getLastAnnounceId()
    {
        const collection = getMongoDatabase()?.collection('workshop.memory');
        if (collection === undefined) {
            return;
        }

        const cursor = await collection.findOne({ 'last_announced_id': { $exists: true } });
        if (cursor === null) {
            return;
        }

        this.lastAnnouncedId = cursor.last_announced_id;
    }

    async checkForUpdates()
    {
        const response = await axios.get(WORKSHOP_HOME);
        const $ = load(response.data);

        const items = $('.workshopItem .ugc').toArray();

        items.forEach((item) => {
            const fileId = $(item).attr('data-publishedfileid');
            fileId && this.itemIds.push(fileId);
        });

        this.itemIds.reverse();

        for (let i = 0; i < this.itemIds.length; i++)
        {
            let id = this.itemIds[i];
            if (id > this.lastAnnouncedId) {
                
                this.lastAnnouncedId = id;
                const itemId = this.itemIds[i];
                const item = new WorkshopItem(itemId);
                await item.build();
                console.log(item);
            }
        }

        const collection = getMongoDatabase()?.collection('workshop.memory');
        if (collection === undefined) {
            return;
        }

        await collection.updateOne({ 'last_announced_id': { $exists: true } }, { $set: { 'last_announced_id': this.lastAnnouncedId } });
    }
}

class WorkshopItem
{
    description: string = '';
    previewImgUrl: string|undefined = '';
    tags: string[] = [];
    title: string = '';
    authors: string[] = [];
    fileId: string;

    constructor(id: string) {
        this.fileId = id;
    }

    async build()
    {
        const url = WORKSHOP_FILE + this.fileId;
        const resp = await axios.get(url);
        const html = resp.data;

        const $ = load(html);

        this.description = $('.workshopItemDescription').text();
        this.previewImgUrl = $('#previewImageMain').attr('src');

        this.title = $('.workshopItemTitle').text();

        const authors = $('.creatorsBlock .friendBlockContent').each((i, elem) => {
            const bs = elem.firstChild as Text;
            bs && this.authors.push(bs.data.trim());
        });
    }
}