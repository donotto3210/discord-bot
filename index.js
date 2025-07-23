// Run: npm install discord.js dotenv fs

const { Client, GatewayIntentBits, Partials, PermissionsBitField, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
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

// Define commands
const commands = [
  new SlashCommandBuilder().setName('securitylogs').setDescription('View logs for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to view').setRequired(true)),

  new SlashCommandBuilder().setName('recordcheck').setDescription('Check records by user ID')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID to check').setRequired(true)),

  new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')),

  new SlashCommandBuilder().setName('unban').setDescription('Unban a user')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true)),

  new SlashCommandBuilder().setName('kick').setDescription('Kick a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')),

  new SlashCommandBuilder().setName('mute').setDescription('Mute user 10 mins')
    .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')),

  new SlashCommandBuilder().setName('unmute').setDescription('Unmute a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to unmute').setRequired(true)),

  new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')),

  new SlashCommandBuilder().setName('unwarn').setDescription('Remove last warning')
    .addUserOption(opt => opt.setName('user').setDescription('User to unwarn').setRequired(true)),

  new SlashCommandBuilder().setName('scammermark').setDescription('Mark user as scammer')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('clearlogs').setDescription('Clear user logs')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('dm').setDescription('DM a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to DM').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Message to send').setRequired(true)),

  new SlashCommandBuilder().setName('raidlock').setDescription('Toggle raid lock')
    .addStringOption(opt => opt.setName('mode').setDescription('on or off').setRequired(true)),

  new SlashCommandBuilder().setName('massban').setDescription('Ban multiple users')
    .addStringOption(opt => opt.setName('ids').setDescription('Comma-separated IDs').setRequired(true)),

  new SlashCommandBuilder().setName('recordcreate').setDescription('Create a manual log entry')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true))
    .addStringOption(opt => opt.setName('action').setDescription('Action type').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder().setName('recorddelete').setDescription('Delete records by user ID')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true))
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Slash commands registered.');
  } catch (err) {
    console.error('Error:', err);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, user, guild, member } = interaction;
  const isMod = member.permissions.has(PermissionsBitField.Flags.ModerateMembers);

  if (!isMod && ['ban','kick','mute','warn','massban','unban','unmute','scammermark','clearlogs','recordcreate','recorddelete','unwarn','dm','raidlock'].includes(commandName)) {
    return interaction.reply({ content: 'You lack permission.', ephemeral: true });
  }

  try {
    switch (commandName) {
      case 'securitylogs': {
        const target = options.getUser('user');
        const data = logs[target.id] || [];
        if (!data.length) return interaction.reply({ content: `No logs for ${target.tag}.`, ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle(`Logs for ${target.tag}`)
          .setColor(0xff5555)
          .setDescription(data.map((log, i) => `**${i + 1}.** [${log.date}] - **${log.action}** by ${log.moderator}\n> ${log.reason}`).join('\n'))
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'recordcheck': {
        const id = options.getString('userid');
        const data = logs[id] || [];
        if (!data.length) return interaction.reply({ content: `No logs for ID ${id}.`, ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle(`Logs for ${id}`)
          .setColor(0xff9900)
          .setDescription(data.map((log, i) => `**${i + 1}.** [${log.date}] - **${log.action}** by ${log.moderator}\n> ${log.reason}`).join('\n'))
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case 'recordcreate': {
        const id = options.getString('userid');
        const action = options.getString('action');
        const reason = options.getString('reason');
        logAction(id, action, reason, user.tag);
        return interaction.reply({ content: `Log added to ${id}.`, ephemeral: true });
      }

      case 'recorddelete': {
        const id = options.getString('userid');
        delete logs[id];
        saveLogs();
        return interaction.reply({ content: `Logs for ${id} cleared.`, ephemeral: true });
      }

      case 'clearlogs': {
        const target = options.getUser('user');
        delete logs[target.id];
        saveLogs();
        return interaction.reply(`Cleared logs for ${target.tag}.`);
      }

      case 'warn': {
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        logAction(target.id, 'Warn', reason, user.tag);
        try { await target.send(`⚠️ You were warned: ${reason}`); } catch {}
        return interaction.reply(`${target.tag} has been warned.`);
      }

      case 'unwarn': {
        const target = options.getUser('user');
        if (logs[target.id]) {
          logs[target.id] = logs[target.id].filter(log => log.action !== 'Warn');
          saveLogs();
        }
        return interaction.reply(`${target.tag}'s last warning removed.`);
      }

      case 'ban': {
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        const memberToBan = await guild.members.fetch(target.id).catch(() => null);
        if (!memberToBan) return interaction.reply({ content: 'User not found.', ephemeral: true });
        await memberToBan.ban({ reason });
        logAction(target.id, 'Ban', reason, user.tag);
        try { await target.send(`🔨 You were banned: ${reason}`); } catch {}
        return interaction.reply(`${target.tag} was banned.`);
      }

      case 'unban': {
        const id = options.getString('userid');
        await guild.members.unban(id);
        return interaction.reply(`Unbanned <@${id}>.`);
      }

      case 'kick': {
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        const memberToKick = await guild.members.fetch(target.id).catch(() => null);
        if (!memberToKick) return interaction.reply({ content: 'User not found.', ephemeral: true });
        await memberToKick.kick(reason);
        logAction(target.id, 'Kick', reason, user.tag);
        try { await target.send(`👢 You were kicked: ${reason}`); } catch {}
        return interaction.reply(`${target.tag} was kicked.`);
      }

      case 'mute': {
        const target = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        const memberToMute = await guild.members.fetch(target.id).catch(() => null);
        if (!memberToMute) return interaction.reply({ content: 'User not found.', ephemeral: true });
        await memberToMute.timeout(10 * 60 * 1000, reason);
        logAction(target.id, 'Mute', reason, user.tag);
        return interaction.reply(`${target.tag} was muted for 10 mins.`);
      }

      case 'unmute': {
        const target = options.getUser('user');
        const memberToUnmute = await guild.members.fetch(target.id).catch(() => null);
        if (!memberToUnmute) return interaction.reply({ content: 'User not found.', ephemeral: true });
        await memberToUnmute.timeout(null);
        return interaction.reply(`${target.tag} was unmuted.`);
      }

      case 'scammermark': {
        const target = options.getUser('user');
        logAction(target.id, 'Scammer Mark', 'Manually marked', user.tag);
        return interaction.reply(`${target.tag} marked as scammer.`);
      }

      case 'dm': {
        const target = options.getUser('user');
        const message = options.getString('message');
        try {
          await target.send(`📬 Message from ${user.tag}: ${message}`);
          return interaction.reply('DM sent.');
        } catch {
          return interaction.reply({ content: 'Failed to DM.', ephemeral: true });
        }
      }

      case 'raidlock': {
        const mode = options.getString('mode');
        const channels = guild.channels.cache.filter(ch => ch.isTextBased());
        const lock = mode === 'on';
        await Promise.all(channels.map(ch => ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: !lock })));
        return interaction.reply(lock ? '🔒 Raid lock enabled.' : '🔓 Raid lock disabled.');
      }

      case 'massban': {
        const ids = options.getString('ids').split(',').map(x => x.trim());
        let success = 0;
        for (const id of ids) {
          try {
            await guild.members.ban(id, { reason: `Massban by ${user.tag}` });
            logAction(id, 'Massban', 'Massban', user.tag);
            success++;
          } catch {}
        }
        return interaction.reply(`Massban done. Success: ${success}/${ids.length}`);
      }

      default: return interaction.reply('Unknown command.');
    }
  } catch (err) {
    console.error(err);
    return interaction.reply({ content: 'Error executing command.', ephemeral: true });
  }
});

client.login(TOKEN);
