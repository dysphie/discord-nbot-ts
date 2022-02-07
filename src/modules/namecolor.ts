import { APIInteractionGuildMember } from "discord-api-types";
import { CommandInteraction, ColorResolvable, GuildMemberRoleManager, GuildMember } from "discord.js";
import namer from 'color-namer';

class Namecolor {

    constructor() {
        console.log("Namecolor module loaded");
    }

    async handleInteraction(interaction: CommandInteraction) {

        if (!interaction || !interaction.guild || !interaction.member) {
            await interaction.reply('This command can only be used in a server.');
            return;
        }

        let hex = interaction.options.getString('hex');
        if (!hex) {
            await interaction.reply('No hex code provided');
            return;
        }

        const roles = interaction.member.roles;
        if (!(roles instanceof GuildMemberRoleManager)) {
            return;
        }

        if (hex == 'none') {
            this.removeOldColors(interaction.member, roles);
            await interaction.reply('Removed custom name color');
            return;
        }

        if (hex.startsWith('#')) {
            hex = hex.substring(1);
        }

        if (!hex.match(/^[0-9A-F]{6}$/i)) {
            await interaction.reply('Invalid hex color');
        }

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            await interaction.reply('Invalid hex color');
            return;
        }

        const colorName = namer(`#${hex}`).ntc[0].name;

        // now create a role with the color
        const newRole = await interaction.guild.roles.create({
            name: `🎨 ${colorName}`,
            color: <ColorResolvable>hex,
            mentionable: false,
            hoist: false,
            position: 0,
            reason: 'Requested name color'
        });

        this.removeOldColors(interaction.member, roles);

        // add the role to the user        
        await roles.add(newRole);
        await interaction.reply(`Your name color has been set to **${colorName}**`);
    }

    removeOldColors(member: GuildMember | APIInteractionGuildMember, roles: GuildMemberRoleManager) { 
        
        for (const role of roles.cache) {
            if (role[1].name.startsWith('🎨') && role[1].members.size <= 1) {
                role[1].delete('Unused name color');
            }
        }
    }
}

const nameColorer = new Namecolor();

export default nameColorer;