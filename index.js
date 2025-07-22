// Run: npm install discord.js dotenv fs

const { Client, GatewayIntentBits, Partials, PermissionsBitField, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const LOG_FILE = 'logs.json';

// Load or create logs file
let logs = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE)) : {};

// Save logs
function saveLogs() {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

// Log action
function logAction(userId, action, reason, moderator) {
  if (!logs[userId]) logs[userId] = [];
  logs[userId].push({ action, reason, moderator, date: new Date().toISOString() });
  saveLogs();
}

// Define commands
const commands = [
  new SlashCommandBuilder()
    .setName('securitylogs')
    .setDescription('View logs for a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to view logs for')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for ban')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for kick')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user for 10 minutes')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to mute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for mute')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to warn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for warning')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('raidlock')
    .setDescription('Enable raid lock on the server'),

  new SlashCommandBuilder()
    .setName('massban')
    .setDescription('Ban multiple users by IDs')
    .addStringOption(option =>
      option.setName('ids')
        .setDescription('Comma separated user IDs to ban')
        .setRequired(true)),
].map(cmd => cmd.toJSON());

// Register commands function
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const member = interaction.member;
  const commandName = interaction.commandName;

  // Mod-only commands list
  const modOnlyCommands = ['ban', 'kick', 'mute', 'warn', 'massban', 'raidlock'];

  if (modOnlyCommands.includes(commandName)) {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
  }

  switch (commandName) {
    case 'securitylogs': {
      const user = interaction.options.getUser('user');
      const data = logs[user.id] || [];
      if (data.length === 0) {
        return interaction.reply({ content: `No logs for ${user.tag}.`, ephemeral: true });
      }
      const entries = data.map((log, i) =>
        `**${i + 1}.** [${log.date}] - **${log.action}** by ${log.moderator} — ${log.reason}`
      ).join('\n');
      return interaction.reply({ content: `Logs for **${user.tag}**:\n${entries}`, ephemeral: true });
    }

    case 'ban': {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      const memberToBan = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!memberToBan) return interaction.reply({ content: 'User not found in guild.', ephemeral: true });
      try {
        await memberToBan.ban({ reason });
        logAction(user.id, 'Ban', reason, interaction.user.tag);
        return interaction.reply(`${user.tag} was banned.`);
      } catch (e) {
        return interaction.reply({ content: `Failed to ban ${user.tag}: ${e.message}`, ephemeral: true });
      }
    }

    case 'kick': {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      const memberToKick = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!memberToKick) return interaction.reply({ content: 'User not found in guild.', ephemeral: true });
      try {
        await memberToKick.kick(reason);
        logAction(user.id, 'Kick', reason, interaction.user.tag);
        return interaction.reply(`${user.tag} was kicked.`);
      } catch (e) {
        return interaction.reply({ content: `Failed to kick ${user.tag}: ${e.message}`, ephemeral: true });
      }
    }

    case 'mute': {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      const memberToMute = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!memberToMute) return interaction.reply({ content: 'User not found in guild.', ephemeral: true });
      try {
        await memberToMute.timeout(10 * 60 * 1000, reason);
        logAction(user.id, 'Mute', reason, interaction.user.tag);
        return interaction.reply(`${user.tag} was muted for 10 minutes.`);
      } catch (e) {
        return interaction.reply({ content: `Failed to mute ${user.tag}: ${e.message}`, ephemeral: true });
      }
    }

    case 'warn': {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      logAction(user.id, 'Warn', reason, interaction.user.tag);
      return interaction.reply(`${user.tag} was warned.`);
    }

    case 'raidlock': {
      const channels = interaction.guild.channels.cache.filter(ch => ch.isTextBased());
      try {
        await Promise.all(channels.map(ch =>
          ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false })
        ));
        return interaction.reply('🔒 Server is now in raid lock.');
      } catch (e) {
        return interaction.reply({ content: `Failed to enable raid lock: ${e.message}`, ephemeral: true });
      }
    }

    case 'massban': {
      const ids = interaction.options.getString('ids').split(',').map(id => id.trim());
      let successCount = 0;
      let failCount = 0;
      for (const id of ids) {
        try {
          await interaction.guild.members.ban(id, { reason: `Massban by ${interaction.user.tag}` });
          logAction(id, 'Massban', 'Massban command', interaction.user.tag);
          successCount++;
        } catch {
          failCount++;
        }
      }
      return interaction.reply(`🔨 Attempted to ban ${ids.length} users. Success: ${successCount}, Failed: ${failCount}`);
    }

    default:
      return interaction.reply({ content: 'Unknown command.', ephemeral: true });
  }
});

client.login(TOKEN);


client.login(process.env.TOKEN);

