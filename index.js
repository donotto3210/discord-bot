// Run: npm install discord.js dotenv fs

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const LOG_FILE = 'logs.json';
const ALLIANCES_FILE = 'alliances.json';

let logs = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE)) : {};
let alliances = fs.existsSync(ALLIANCES_FILE) ? JSON.parse(fs.readFileSync(ALLIANCES_FILE)) : [];

function saveLogs() {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

function saveAlliances() {
  fs.writeFileSync(ALLIANCES_FILE, JSON.stringify(alliances, null, 2));
}

function logAction(userId, action, reason, moderator) {
  if (!logs[userId]) logs[userId] = [];
  logs[userId].push({ action, reason, moderator, date: new Date().toISOString() });
  saveLogs();
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')),

  new SlashCommandBuilder().setName('unban').setDescription('Unban a user')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true)),

  new SlashCommandBuilder().setName('kick').setDescription('Kick a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')),

  new SlashCommandBuilder().setName('mute').setDescription('Mute a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')),

  new SlashCommandBuilder().setName('unmute').setDescription('Unmute a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')),

  new SlashCommandBuilder().setName('unwarn').setDescription('Remove a specific warning from a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(opt => opt.setName('index').setDescription('Warning index (from logs)').setRequired(true)),

  new SlashCommandBuilder().setName('raidlock').setDescription('Toggle raidlock')
    .addStringOption(opt => opt.setName('mode').setDescription('on or off').setRequired(true)),

  new SlashCommandBuilder().setName('securitylogs').setDescription('View user logs')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('clearlogs').setDescription('Clear all logs for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('scammer').setDescription('Mark user as scammer')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('recordscreate').setDescription('Create custom log by user ID')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true))
    .addStringOption(opt => opt.setName('action').setDescription('Action taken').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder().setName('recordsdelete').setDescription('Delete logs of a user by ID')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true)),

  new SlashCommandBuilder().setName('recordscheck').setDescription('Check logs by user ID')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true)),

  new SlashCommandBuilder().setName('checkid').setDescription('Get user from ID')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true)),

  new SlashCommandBuilder().setName('checkuser').setDescription('Get ID of a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('allycreate').setDescription('Add alliance by server ID')
    .addStringOption(opt => opt.setName('serverid').setDescription('Server ID').setRequired(true)),

  new SlashCommandBuilder().setName('allydelete').setDescription('Remove alliance by server ID')
    .addStringOption(opt => opt.setName('serverid').setDescription('Server ID').setRequired(true)),

  new SlashCommandBuilder().setName('alliancecheck').setDescription('Check current alliances')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
async function registerCommands() {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Commands registered.');
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const modRole = interaction.guild.roles.cache.find(r => r.name === 'Mod');
  if (!interaction.member.roles.cache.has(modRole?.id)) {
    return interaction.reply({ content: '❌ You need the Mod role to use this command.', ephemeral: true });
  }

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'No reason';
  const minutes = interaction.options.getInteger('minutes');

  switch (interaction.commandName) {
    case 'ban':
      await interaction.guild.members.ban(user.id, { reason });
      logAction(user.id, 'Ban', reason, interaction.user.tag);
      user.send(`You were banned: ${reason}`).catch(() => {});
      return interaction.reply(`${user.tag} was banned.`);

    case 'unban':
      await interaction.guild.members.unban(interaction.options.getString('userid'));
      return interaction.reply('User unbanned.');

    case 'kick':
      await interaction.guild.members.kick(user.id, reason);
      logAction(user.id, 'Kick', reason, interaction.user.tag);
      user.send(`You were kicked: ${reason}`).catch(() => {});
      return interaction.reply(`${user.tag} was kicked.`);

    case 'mute':
      await interaction.guild.members.fetch(user.id).then(m => m.timeout(minutes * 60000, reason));
      logAction(user.id, `Mute (${minutes}m)`, reason, interaction.user.tag);
      user.send(`You were muted for ${minutes} minutes: ${reason}`).catch(() => {});
      return interaction.reply(`${user.tag} muted for ${minutes} minutes.`);

    case 'unmute':
      await interaction.guild.members.fetch(user.id).then(m => m.timeout(null));
      return interaction.reply(`${user.tag} has been unmuted.`);

    case 'warn':
      logAction(user.id, 'Warn', reason, interaction.user.tag);
      user.send(`You were warned: ${reason}`).catch(() => {});
      return interaction.reply(`${user.tag} warned.`);

    case 'unwarn':
      const index = interaction.options.getInteger('index') - 1;
      if (logs[user.id] && logs[user.id][index]) {
        logs[user.id].splice(index, 1);
        saveLogs();
        return interaction.reply(`Warning #${index + 1} removed from ${user.tag}.`);
      } else {
        return interaction.reply('Invalid index.');
      }

    case 'raidlock':
      const mode = interaction.options.getString('mode');
      const canSend = mode === 'off';
      await Promise.all(interaction.guild.channels.cache
        .filter(ch => ch.isTextBased())
        .map(ch => ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: canSend })));
      return interaction.reply(`Raidlock ${mode === 'on' ? 'enabled' : 'disabled'}.`);

    case 'securitylogs':
      const data = logs[user.id] || [];
      if (data.length === 0) return interaction.reply('No logs found.');
      const embed = new EmbedBuilder().setTitle(`${user.tag} Logs`)
        .setDescription(data.map((l, i) => `**${i + 1}.** [${l.date}] **${l.action}** by ${l.moderator} — ${l.reason}`).join('\n'))
        .setColor('Red');
      return interaction.reply({ embeds: [embed] });

    case 'clearlogs':
      logs[user.id] = [];
      saveLogs();
      return interaction.reply(`${user.tag}'s logs cleared.`);

    case 'scammer':
      logAction(user.id, 'Scammer Marked', 'Marked as scammer', interaction.user.tag);
      return interaction.reply(`${user.tag} marked as scammer.`);

    case 'recordscreate':
      logAction(interaction.options.getString('userid'), interaction.options.getString('action'), interaction.options.getString('reason'), interaction.user.tag);
      return interaction.reply('Record added.');

    case 'recordscheck': {
      const uid = interaction.options.getString('userid');
      const entries = logs[uid] || [];
      if (entries.length === 0) return interaction.reply('No logs found.');
      return interaction.reply(`Logs for ${uid}:\n${entries.map((l, i) => `**${i + 1}.** ${l.action} by ${l.moderator} - ${l.reason}`).join('\n')}`);
    }

    case 'recordsdelete':
      logs[interaction.options.getString('userid')] = [];
      saveLogs();
      return interaction.reply('Logs deleted.');

    case 'checkid':
      try {
        const fetched = await client.users.fetch(interaction.options.getString('userid'));
        return interaction.reply(`User: ${fetched.tag}`);
      } catch {
        return interaction.reply('User not found.');
      }

    case 'checkuser':
      return interaction.reply(`ID: ${user.id}`);

    case 'allycreate':
      const sidAdd = interaction.options.getString('serverid');
      if (!alliances.includes(sidAdd)) {
        alliances.push(sidAdd);
        saveAlliances();
      }
      return interaction.reply('Alliance added.');

    case 'allydelete':
      const sidDel = interaction.options.getString('serverid');
      alliances = alliances.filter(id => id !== sidDel);
      saveAlliances();
      return interaction.reply('Alliance removed.');

    case 'alliancecheck':
      return interaction.reply(`Allied servers:\n${alliances.join('\n') || 'None'}`);

    default:
      return interaction.reply('Unknown command.');
  }
});

client.login(TOKEN);
