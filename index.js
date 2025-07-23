// Run: npm install discord.js dotenv fs

const { 
  Client, GatewayIntentBits, Partials, PermissionsBitField, 
  SlashCommandBuilder, REST, Routes 
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
function saveLogs() { fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2)); }
function logAction(userId, action, reason, moderator) {
  if (!logs[userId]) logs[userId] = [];
  logs[userId].push({ action, reason, moderator, date: new Date().toISOString() });
  saveLogs();
}

const commands = [
  new SlashCommandBuilder().setName('securitylogs').setDescription('View logs for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to view logs').setRequired(true)),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban')),
  new SlashCommandBuilder().setName('kick').setDescription('Kick a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick')),
  new SlashCommandBuilder().setName('mute').setDescription('Mute a user for a duration')
    .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
    .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for mute')),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning')),
  new SlashCommandBuilder().setName('raidlock').setDescription('Enable raid lock on the server'),
  new SlashCommandBuilder().setName('massban').setDescription('Ban multiple users by IDs')
    .addStringOption(opt => opt.setName('ids').setDescription('Comma separated IDs').setRequired(true)),
  new SlashCommandBuilder().setName('clearlogs').setDescription('Clear logs for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to clear logs').setRequired(true)),
  new SlashCommandBuilder().setName('dm').setDescription('Send DM to a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to DM').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Message to send').setRequired(true)),
  new SlashCommandBuilder().setName('recordscreate').setDescription('Create a manual record')
    .addStringOption(opt => opt.setName('id').setDescription('User ID').setRequired(true))
    .addStringOption(opt => opt.setName('action').setDescription('Action (e.g. Warn)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
  new SlashCommandBuilder().setName('recordscheck').setDescription('Check logs by user ID')
    .addStringOption(opt => opt.setName('id').setDescription('User ID').setRequired(true)),
  new SlashCommandBuilder().setName('recordsdelete').setDescription('Delete logs for user ID')
    .addStringOption(opt => opt.setName('id').setDescription('User ID').setRequired(true)),
  new SlashCommandBuilder().setName('checkid').setDescription('Get user by ID')
    .addStringOption(opt => opt.setName('id').setDescription('User ID').setRequired(true)),
  new SlashCommandBuilder().setName('checkuser').setDescription('Get ID from user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Commands registered.');
  } catch (e) {
    console.error('Command registration failed:', e);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, user, member, guild } = interaction;
  const modCommands = ['ban', 'kick', 'mute', 'warn', 'massban', 'raidlock', 'clearlogs', 'dm', 'recordscreate', 'recordsdelete'];

  if (modCommands.includes(commandName)) {
    if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: '🚫 You do not have permission.', ephemeral: true });
    }
  }

  try {
    switch (commandName) {
      case 'securitylogs': {
        const target = options.getUser('user');
        const data = logs[target.id] || [];
        if (!data.length) return interaction.reply({ content: `No logs for ${target.tag}`, ephemeral: true });
        const msg = data.map((log, i) => `**${i+1}.** [${log.date}] - **${log.action}** by ${log.moderator} — ${log.reason}`).join('\n');
        return interaction.reply({ content: `Logs for **${target.tag}**:\n${msg}`, ephemeral: true });
      }

      case 'ban': {
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        const memberToBan = await guild.members.fetch(target.id).catch(() => null);
        if (!memberToBan) return interaction.reply({ content: 'User not in server.', ephemeral: true });
        await memberToBan.send(`You were **banned** from ${guild.name}. Reason: ${reason}`).catch(() => {});
        await memberToBan.ban({ reason });
        logAction(target.id, 'Ban', reason, user.tag);
        return interaction.reply(`${target.tag} was banned.`);
      }

      case 'kick': {
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        const memberToKick = await guild.members.fetch(target.id).catch(() => null);
        if (!memberToKick) return interaction.reply({ content: 'User not in server.', ephemeral: true });
        await memberToKick.send(`You were **kicked** from ${guild.name}. Reason: ${reason}`).catch(() => {});
        await memberToKick.kick(reason);
        logAction(target.id, 'Kick', reason, user.tag);
        return interaction.reply(`${target.tag} was kicked.`);
      }

      case 'mute': {
        const target = options.getUser('user');
        const duration = options.getInteger('duration');
        const reason = options.getString('reason') || 'No reason';
        const memberToMute = await guild.members.fetch(target.id).catch(() => null);
        if (!memberToMute) return interaction.reply({ content: 'User not in server.', ephemeral: true });
        await memberToMute.timeout(duration * 60000, reason);
        await target.send(`You were **muted** for ${duration} minutes. Reason: ${reason}`).catch(() => {});
        logAction(target.id, `Mute (${duration}m)`, reason, user.tag);
        return interaction.reply(`${target.tag} was muted for ${duration} minutes.`);
      }

      case 'warn': {
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        await target.send(`You were **warned** in ${guild.name}. Reason: ${reason}`).catch(() => {});
        logAction(target.id, 'Warn', reason, user.tag);
        return interaction.reply(`${target.tag} was warned.`);
      }

      case 'raidlock': {
        const channels = guild.channels.cache.filter(ch => ch.isTextBased());
        await Promise.all(channels.map(ch => ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false })));
        return interaction.reply('🔒 Server is now in raid lock.');
      }

      case 'massban': {
        const ids = options.getString('ids').split(',').map(id => id.trim());
        let success = 0, fail = 0;
        for (const id of ids) {
          try {
            await guild.members.ban(id, { reason: `Massban by ${user.tag}` });
            logAction(id, 'Massban', 'Massban command', user.tag);
            success++;
          } catch { fail++; }
        }
        return interaction.reply(`Banned ${success}/${ids.length} users.`);
      }

      case 'clearlogs': {
        const target = options.getUser('user');
        delete logs[target.id];
        saveLogs();
        return interaction.reply(`🧹 Logs for ${target.tag} cleared.`);
      }

      case 'dm': {
        const target = options.getUser('user');
        const message = options.getString('message');
        await target.send(message).catch(() => {
          return interaction.reply({ content: '❌ Failed to DM user.', ephemeral: true });
        });
        return interaction.reply(`📩 DM sent to ${target.tag}`);
      }

      case 'recordscreate': {
        const id = options.getString('id');
        const action = options.getString('action');
        const reason = options.getString('reason');
        logAction(id, action, reason, user.tag);
        return interaction.reply(`✅ Record for ${id} created.`);
      }

      case 'recordscheck': {
        const id = options.getString('id');
        const data = logs[id] || [];
        if (!data.length) return interaction.reply({ content: 'No logs for that ID.', ephemeral: true });
        const msg = data.map((log, i) => `**${i+1}.** [${log.date}] - **${log.action}** by ${log.moderator} — ${log.reason}`).join('\n');
        return interaction.reply({ content: `Logs for **${id}**:\n${msg}`, ephemeral: true });
      }

      case 'recordsdelete': {
        const id = options.getString('id');
        delete logs[id];
        saveLogs();
        return interaction.reply(`🧹 Logs for ${id} deleted.`);
      }

      case 'checkid': {
        const id = options.getString('id');
        try {
          const target = await client.users.fetch(id);
          return interaction.reply(`User: **${target.tag}**`);
        } catch {
          return interaction.reply({ content: '❌ Could not find user.', ephemeral: true });
        }
      }

      case 'checkuser': {
        const target = options.getUser('user');
        return interaction.reply(`User ID: **${target.id}**`);
      }
    }
  } catch (e) {
    console.error(e);
    return interaction.reply({ content: '❌ Error executing command.', ephemeral: true });
  }
});

client.login(TOKEN);
