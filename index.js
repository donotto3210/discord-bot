// Run: npm install discord.js dotenv fs

const { 
  Client, GatewayIntentBits, Partials, PermissionsBitField,
  SlashCommandBuilder, REST, Routes, EmbedBuilder 
} = require('discord.js');
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
let logs = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE)) : {};

function saveLogs() {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

function logAction(userId, action, reason, moderator) {
  if (!logs[userId]) logs[userId] = [];
  logs[userId].push({ action, reason, moderator, date: new Date().toISOString() });
  saveLogs();
}

const commands = [
  new SlashCommandBuilder()
    .setName('securitylogs')
    .setDescription('View logs for a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to view logs for').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for ban').setRequired(false)),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for kick').setRequired(false)),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user for 10 minutes')
    .addUserOption(option =>
      option.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for mute').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove mute from a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to unmute').setRequired(true)),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for warning').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Remove the most recent warning from a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to remove warning from').setRequired(true)),

  new SlashCommandBuilder()
    .setName('raidlock')
    .setDescription('Toggle raid lock on or off')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('on or off')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .addStringOption(option =>
      option.setName('userid').setDescription('User ID to unban').setRequired(true)),

  new SlashCommandBuilder()
    .setName('scammermark')
    .setDescription('Mark a user as a scammer in logs')
    .addUserOption(option =>
      option.setName('user').setDescription('User to mark').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder()
    .setName('massban')
    .setDescription('Ban multiple users by IDs')
    .addStringOption(option =>
      option.setName('ids').setDescription('Comma separated user IDs to ban').setRequired(true)),
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
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
  const modOnlyCommands = ['ban', 'kick', 'mute', 'warn', 'massban', 'raidlock', 'unmute', 'unwarn', 'unban', 'scammermark'];

  if (modOnlyCommands.includes(commandName)) {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
  }

  switch (commandName) {
    case 'securitylogs': {
      const user = interaction.options.getUser('user');
      const data = logs[user.id] || [];
      if (data.length === 0) return interaction.reply({ content: `No logs for ${user.tag}.`, ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(`Security Logs for ${user.tag}`)
        .setColor(0xffaa00)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `User ID: ${user.id}` });

      data.slice(-10).reverse().forEach(entry => {
        embed.addFields({
          name: `${entry.action} | ${new Date(entry.date).toLocaleString()}`,
          value: `**Moderator:** ${entry.moderator}\n**Reason:** ${entry.reason || 'No reason'}`
        });
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    case 'ban': {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      const memberToBan = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!memberToBan) return interaction.reply({ content: 'User not found in guild.', ephemeral: true });
      await memberToBan.ban({ reason });
      logAction(user.id, 'Ban', reason, interaction.user.tag);
      return interaction.reply(`${user.tag} was banned.`);
    }

    case 'kick': {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      const memberToKick = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!memberToKick) return interaction.reply({ content: 'User not found in guild.', ephemeral: true });
      await memberToKick.kick(reason);
      logAction(user.id, 'Kick', reason, interaction.user.tag);
      return interaction.reply(`${user.tag} was kicked.`);
    }

    case 'mute': {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      const memberToMute = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!memberToMute) return interaction.reply({ content: 'User not found in guild.', ephemeral: true });
      await memberToMute.timeout(10 * 60 * 1000, reason);
      logAction(user.id, 'Mute', reason, interaction.user.tag);
      return interaction.reply(`${user.tag} was muted for 10 minutes.`);
    }

    case 'unmute': {
      const user = interaction.options.getUser('user');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found in guild.', ephemeral: true });
      await member.timeout(null);
      logAction(user.id, 'Unmute', 'Unmuted by moderator', interaction.user.tag);
      return interaction.reply(`${user.tag} has been unmuted.`);
    }

    case 'warn': {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason';
      logAction(user.id, 'Warn', reason, interaction.user.tag);
      return interaction.reply(`${user.tag} was warned.`);
    }

    case 'unwarn': {
      const user = interaction.options.getUser('user');
      if (!logs[user.id] || logs[user.id].length === 0)
        return interaction.reply({ content: `${user.tag} has no warnings.`, ephemeral: true });

      const index = logs[user.id].findIndex(log => log.action.toLowerCase() === 'warn');
      if (index === -1)
        return interaction.reply({ content: `No warnings to remove for ${user.tag}.`, ephemeral: true });

      logs[user.id].splice(index, 1);
      saveLogs();
      return interaction.reply(`${user.tag}'s most recent warning has been removed.`);
    }

    case 'raidlock': {
      const mode = interaction.options.getString('mode');
      const channels = interaction.guild.channels.cache.filter(ch => ch.isTextBased());
      await Promise.all(channels.map(ch =>
        ch.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: mode === 'on' ? false : null
        })
      ));
      return interaction.reply(`Raid lock ${mode === 'on' ? '🔒 enabled' : '🔓 disabled'}.`);
    }

    case 'unban': {
      const userId = interaction.options.getString('userid');
      await interaction.guild.members.unban(userId);
      logAction(userId, 'Unban', 'Unbanned by moderator', interaction.user.tag);
      return interaction.reply(`Unbanned user with ID: ${userId}`);
    }

    case 'scammermark': {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      logAction(user.id, 'Scammer Mark', reason, interaction.user.tag);
      return interaction.reply(`${user.tag} has been marked as a scammer in logs.`);
    }

    case 'massban': {
      const ids = interaction.options.getString('ids').split(',').map(id => id.trim());
      let success = 0, fail = 0;
      for (const id of ids) {
        try {
          await interaction.guild.members.ban(id, { reason: `Massban by ${interaction.user.tag}` });
          logAction(id, 'Massban', 'Massban command', interaction.user.tag);
          success++;
        } catch {
          fail++;
        }
      }
      return interaction.reply(`🔨 Attempted to ban ${ids.length} users. Success: ${success}, Failed: ${fail}`);
    }

    default:
      return interaction.reply({ content: 'Unknown command.', ephemeral: true });
  }
});

client.login(TOKEN);
