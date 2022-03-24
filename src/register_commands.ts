import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

const weather = new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Retrieves the weather for a given location')
    .addStringOption(option =>
        option.setName('location')
            .setDescription('Country, state, city, or address')
            .setRequired(false))

const animal = new SlashCommandBuilder()
.setName('animal')
.setDescription('Posts a random animal')
.addStringOption(option =>
    option
    .setDescription('The animal to post')
    .setRequired(true)
    .setName('species')
    .setChoices([
        ['cat', 'cat'],
        ['dog', 'dog'],
        ['lizard', 'lizard'],
    ]))

const namecolor = new SlashCommandBuilder()
    .setName('namecolor')
    .setDescription('Gives you a custom name color')
    .addStringOption(option =>
        option.setName('hex')
            .setDescription('Hex code for the color')
            .setRequired(true))


const inspire = new SlashCommandBuilder()
    .setName('inspire')
    .setDescription('Retrieves a random inspirational quote')

const wordle = new SlashCommandBuilder()
    .setName('wordle')
    .setDescription('Starts a game of wordle')
    .addIntegerOption(option =>
        option.setName('length')
            .setDescription('The length of the words to use')
            .setRequired(false))


const emoter = new SlashCommandBuilder()
.setName('emoter')
.setDescription('Interact with the emoter module')
.addSubcommand(subcommand =>
    subcommand
        .setName('test')
        .setDescription('Test whether a specific keyword resolves to a valid emote')
        .addStringOption(option => option.setName('keyword').setDescription('Keyword to match against').setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('add')
        .setDescription('Add a keyword to the emoter module')
        .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
            .setRequired(true))
        .addStringOption(option => option.setName('url').setDescription('Emote image URL. Supports JPG, PNG and GIF')
            .setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('edit')
        .setDescription('Edit a keyword in the emoter module')
        .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
            .setRequired(true))
        .addStringOption(option => option.setName('url').setDescription('New emote image URL. Supports JPG, PNG and GIF')
            .setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('remove')
        .setDescription('Removes a keyword from the emoter module')
        .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
            .setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('find')
        .setDescription('Find possible emotes for a partial keyword')
        .addStringOption(option => option.setName('keyword').setDescription('Emote keyword')
            .setRequired(true)))
.addSubcommand(subcommand =>
    subcommand
        .setName('random')
        .setDescription('Posts a random emote to chat'))

const commands = [
    weather.toJSON(),
    namecolor.toJSON(),
    inspire.toJSON(),
    animal.toJSON(),
    emoter.toJSON(),
    wordle.toJSON(),
];

const registerCommands = async (clientId: string, token: string) => {
    const rest = new REST({ version: '9' }).setToken(token);
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

export default registerCommands;