import { ChatInputCommandInteraction } from "discord.js";
import { getMongoDatabase } from "./mongodb";

const MODULE_MASTER = '232909513378758657';

class Module
{
  name: string;
  description: string;
  enabledGuildIds: Set<string>

  constructor(name: string, description: string)
  {
    this.name = name;
    this.description = description;
    this.enabledGuildIds = new Set<string>();
    console.log(`Module ${this.name} loaded`);
  }

  isEnabled(guildId: string|null): boolean
  {
    return guildId !== null && this.enabledGuildIds.has(guildId);
  }

  enable(guildId: string)
  {
    this.enabledGuildIds.add(guildId);
  }

  disable(guildId: string)
  {
    this.enabledGuildIds.delete(guildId);
  }
}

class DatabaseModule extends Module
{
  async cacheDatabaseData(): Promise<void>
  {
    const db = getMongoDatabase();
    if (db === null) {
      console.log('cacheDatabaseData: db is null');
      return;
    }

    const dbModules = await db.collection('enabled_modules').find({
      module: this.name
    }).toArray();

    dbModules.forEach((dbModule) => {

      this.enabledGuildIds.add(dbModule.guild);
      console.log(`[${this.name}] Enabled for guild ${dbModule.guild}`);
    });
  }

  async dbEnable(guildId: string): Promise<string|null> {

    const db = getMongoDatabase();
    if (db === null) {
      return 'Failed to connect to database';
    }

    await db.collection('enabled_modules').updateOne({
      guild: guildId,
      module: this.name
    },
    {
      $setOnInsert: {
        guild: guildId,
        module: this.name
      }
    },
    {
      upsert: true
    });

    this.enable(guildId);
    return null;
  }

  async dBdisable(guildId: string): Promise<string|null> {

    const db = getMongoDatabase();
    if (db === null) {
      return 'Failed to connect to database';
    }

    await db.collection('enabled_modules').deleteMany({
      guildId: guildId,
      moduleName: this.name
    });

    this.disable(guildId);
    return null;
  }
}

class ModuleManager
{
  modules: DatabaseModule[];

  constructor()
  {
    this.modules = [];
  }

  async registerModule(module: DatabaseModule)
  {
    if (this.modules.find((m) => m.name === module.name)) {
      throw new Error(`Module ${module.name} already registered`);
    }

    this.modules.push(module);
    console.log(`✔️ Module ${module.name} registered`);
  }

  async commandListModules(interaction: ChatInputCommandInteraction, guildId: string)
  {
    if (this.modules.length === 0) {
      interaction.reply(`No modules registered`);
      return;
    }

    let msg = '';
    this.modules.forEach(module => {
      console.log('Found module named ' + module.name);
      const emoji = module.isEnabled(guildId) ? '\\✔️' : '\\❌';
      msg += `${emoji} ${module.name} - ${module.description}\n`;
    });

    await interaction.reply(msg);
  }

  async commandModule(interaction: ChatInputCommandInteraction) {

    const app = await interaction.client.application?.fetch();
    if (!app || interaction.user.id !== app.owner?.id) {
      await interaction.reply('Only the bot owner can use this command');
      return;
    }

    const guildId = interaction.guildId;
    if (guildId === null) {
      await interaction.reply("This command can only be used in a server.");
      return;
    }

    const subcmd = interaction.options.getSubcommand();

    switch (subcmd) {
      case 'list':
        await this.commandListModules(interaction, guildId);
        break;

      case 'enable':
        await this.commandToggleModule(interaction, guildId, true);
        break;

      case 'disable':
        await this.commandToggleModule(interaction, guildId, false);
        break;

      default:
        await interaction.reply("Invalid subcommand.");
        break;
    }
  }

  async commandToggleModule(interaction: ChatInputCommandInteraction, guildId: string, state: boolean) {

    const moduleName = interaction.options.getString('name');
    if (moduleName === null) {
      await interaction.reply("You must specify a module name.");
      return;
    }

    const module = this.modules.find(m => m.name === moduleName);
    if (module === undefined) {
      await interaction.reply(`Module ${moduleName} not found.`);
      return;
    }

    if (state) {
      await module.dbEnable(guildId);
      await interaction.reply(`Enabled module ${moduleName} for this server.`);
    } else {
      await module.dBdisable(guildId);
      await interaction.reply(`Disabled module ${moduleName} for this server.`);
    }
  }
}

export { ModuleManager, DatabaseModule, Module };