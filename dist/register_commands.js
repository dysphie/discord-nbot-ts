"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const builders_1 = require("@discordjs/builders");
const rest_1 = require("@discordjs/rest");
const v9_1 = require("discord-api-types/v9");
const weather = new builders_1.SlashCommandBuilder()
    .setName('weather')
    .setDescription('Retrieves the weather for a given location')
    .addStringOption(option => option.setName('location')
    .setDescription('Country, state, city, or address')
    .setRequired(false));
const animal = new builders_1.SlashCommandBuilder()
    .setName('animal')
    .setDescription('Posts a random animal')
    .addStringOption(option => option
    .setDescription('The animal to post')
    .setRequired(true)
    .setName('species')
    .setChoices([
    ['cat', 'cat'],
    ['dog', 'dog'],
    ['lizard', 'lizard'],
]));
const namecolor = new builders_1.SlashCommandBuilder()
    .setName('namecolor')
    .setDescription('Gives you a custom name color')
    .addStringOption(option => option.setName('hex')
    .setDescription('Hex code for the color')
    .setRequired(true));
const inspire = new builders_1.SlashCommandBuilder()
    .setName('inspire')
    .setDescription('Retrieves a random inspirational quote');
const emoter = new builders_1.SlashCommandBuilder()
    .setName('emoter')
    .setDescription('Interact with the emoter module')
    .addSubcommand(subcommand => subcommand
    .setName('test')
    .setDescription('Test whether a specific keyword resolves to a valid emote')
    .addStringOption(option => option.setName('keyword').setDescription('Keyword to match against').setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('add')
    .setDescription('Add a keyword to the emoter module')
    .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
    .setRequired(true))
    .addStringOption(option => option.setName('url').setDescription('Emote image URL. Supports JPG, PNG and GIF')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('edit')
    .setDescription('Edit a keyword in the emoter module')
    .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
    .setRequired(true))
    .addStringOption(option => option.setName('url').setDescription('New emote image URL. Supports JPG, PNG and GIF')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('remove')
    .setDescription('Removes a keyword from the emoter module')
    .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('find')
    .setDescription('Find possible emotes for a partial keyword')
    .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('random')
    .setDescription('Posts a random emote to chat'));
const commands = [
    weather.toJSON(),
    namecolor.toJSON(),
    inspire.toJSON(),
    animal.toJSON(),
    emoter.toJSON()
];
const registerCommands = async (clientId, token) => {
    const rest = new rest_1.REST({ version: '9' }).setToken(token);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(v9_1.Routes.applicationCommands(clientId), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    }
    catch (error) {
        console.error(error);
    }
};
exports.default = registerCommands;
//# sourceMappingURL=register_commands.js.map