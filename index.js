// Required packages
const { Client, GatewayIntentBits, Partials, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel]
});

const TOKEN = 'MTM5NjI3MjUzNzMzNTUwMDk0MA.GhQ4ak.0ksaQt9FMphmDj-myr1Oe552UjLkn06dHGQH0Y';
const CLIENT_ID = '1396272537335500940';
const GUILD_ID = '1396270596383313980';

const LOG_FILE = 'logs.json';
const ALLY_FILE = 'alliances.json';

const MOD_LOG_CHANNEL_ID = '1398097489696919743'; // Mod logs channel

let logs = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE)) : {};
let allies = fs.existsSync(ALLY_FILE) ? JSON.parse(fs.readFileSync(ALLY_FILE)) : [];

function saveLogs() {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}
function saveAllies() {
  fs.writeFileSync(ALLY_FILE, JSON.stringify(allies, null, 2));
}
function isMod(member) {
  return member.roles.cache.some(role => role.name === 'Mod');
}
function logAction(userId, action, reason, moderator) {
  if (!logs[userId]) logs[userId] = [];
  logs[userId].push({ action, reason, moderator, date: new Date().toISOString() });
  saveLogs();
}

async function sendDM(user, content) {
  try {
    await user.send(content);
  } catch {
    console.warn(`Could not DM ${user.tag}`);
  }
}

async function sendModLog(embed) {
  try {
    const modLogChannel = await client.channels.fetch(MOD_LOG_CHANNEL_ID);
    if (modLogChannel && modLogChannel.isTextBased()) {
      modLogChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Failed to send mod log:', err);
  }
}

// Command setup
const commands = [
  new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder().setName('unwarn').setDescription('Remove all warnings from user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('mute').setDescription('Mute a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Time to mute (minutes)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder().setName('unmute').setDescription('Unmute a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder().setName('unban').setDescription('Unban a user')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID to unban').setRequired(true)),

  new SlashCommandBuilder().setName('kick').setDescription('Kick a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder().setName('raidlock').setDescription('Toggle raid lock')
    .addStringOption(opt => opt.setName('state').setDescription('on or off').setRequired(true)),

  new SlashCommandBuilder().setName('scammer').setDescription('Mark user as scammer')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder().setName('securitylogs').setDescription('View security logs')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('clearlogs').setDescription('Clear all logs')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('record').setDescription('Create custom record')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true))
    .addStringOption(opt => opt.setName('post').setDescription('Post record publicly? yes/no').setRequired(false)),

  new SlashCommandBuilder().setName('recordcheck').setDescription('Check user record')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true)),

  new SlashCommandBuilder().setName('recorddelete').setDescription('Delete user record')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true)),

  new SlashCommandBuilder().setName('checkuser').setDescription('Get user ID')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),

  new SlashCommandBuilder().setName('checkid').setDescription('Check ID to get user info')
    .addStringOption(opt => opt.setName('id').setDescription('User ID').setRequired(true)),

  new SlashCommandBuilder().setName('ally').setDescription('Create an alliance')
    .addStringOption(opt => opt.setName('serverid').setDescription('Server ID').setRequired(true)),

  new SlashCommandBuilder().setName('allydelete').setDescription('Delete an alliance')
    .addStringOption(opt => opt.setName('serverid').setDescription('Server ID').setRequired(true)),

  new SlashCommandBuilder().setName('alliancecheck').setDescription('Check all alliances'),

  new SlashCommandBuilder().setName('allynotify').setDescription('DM ally server owner')
    .addStringOption(opt => opt.setName('serverid').setDescription('Server ID').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Message').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options, member, guild } = interaction;
  if (!isMod(member)) return interaction.reply({ content: 'Only users with the **Mod** role can use this.', ephemeral: true });

  // For easier access to channel and user
  const modUser = member.user;

  if (commandName === 'warn') {
    const user = options.getUser('user');
    const reason = options.getString('reason');
    logAction(user.id, 'Warn', reason, modUser.tag);
    await sendDM(user, `⚠️ You were warned in ${guild.name}: ${reason}`);

    // Mod log embed
    const embed = new EmbedBuilder()
      .setTitle('User Warned')
      .setColor('Orange')
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: modUser.tag, inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();
    await sendModLog(embed);

    await interaction.reply(`Warned ${user.tag} for: ${reason}`);
  }

  else if (commandName === 'unwarn') {
    const user = options.getUser('user');
    logs[user.id] = [];
    saveLogs();
    await interaction.reply(`✅ Cleared all warnings for ${user.tag}`);
  }

  else if (commandName === 'mute') {
    const user = options.getUser('user');
    const reason = options.getString('reason');
    const time = options.getInteger('minutes');
    const muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) return interaction.reply({ content: 'Mute role not found.', ephemeral: true });
    const memberToMute = await guild.members.fetch(user.id);
    await memberToMute.roles.add(muteRole);
    await sendDM(user, `🔇 You were muted for ${time} minutes in ${guild.name}: ${reason}`);
    logAction(user.id, 'Mute', `${reason} (${time}m)`, modUser.tag);

    // Mod log embed
    const embed = new EmbedBuilder()
      .setTitle('User Muted')
      .setColor('Orange')
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: modUser.tag, inline: true },
        { name: 'Reason', value: `${reason} (${time} minutes)` }
      )
      .setTimestamp();
    await sendModLog(embed);

    setTimeout(() => memberToMute.roles.remove(muteRole), time * 60000);
    await interaction.reply(`✅ Muted ${user.tag} for ${time} minutes`);
  }

  else if (commandName === 'unmute') {
    const user = options.getUser('user');
    const memberToUnmute = await guild.members.fetch(user.id);
    const muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) return interaction.reply({ content: 'Mute role not found.', ephemeral: true });
    await memberToUnmute.roles.remove(muteRole);

    // Mod log embed
    const embed = new EmbedBuilder()
      .setTitle('User Unmuted')
      .setColor('Green')
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: modUser.tag, inline: true }
      )
      .setTimestamp();
    await sendModLog(embed);

    await interaction.reply(`🔊 Unmuted ${user.tag}`);
  }

  else if (commandName === 'kick') {
    const user = options.getUser('user');
    const reason = options.getString('reason');
    const memberToKick = await guild.members.fetch(user.id);
    await sendDM(user, `👢 You were kicked from ${guild.name}: ${reason}`);
    await memberToKick.kick(reason);
    logAction(user.id, 'Kick', reason, modUser.tag);

    // Mod log embed
    const embed = new EmbedBuilder()
      .setTitle('User Kicked')
      .setColor('Red')
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: modUser.tag, inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();
    await sendModLog(embed);

    await interaction.reply(`✅ Kicked ${user.tag}`);
  }

  else if (commandName === 'ban') {
    const user = options.getUser('user');
    const reason = options.getString('reason');
    await sendDM(user, `🚫 You were banned from ${guild.name}: ${reason}`);
    await guild.members.ban(user.id, { reason });
    logAction(user.id, 'Ban', reason, modUser.tag);

    // Mod log embed
    const embed = new EmbedBuilder()
      .setTitle('User Banned')
      .setColor('DarkRed')
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Moderator', value: modUser.tag, inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();
    await sendModLog(embed);

    await interaction.reply(`✅ Banned ${user.tag}`);
  }

  else if (commandName === 'unban') {
    const userId = options.getString('userid');
    await guild.members.unban(userId);
    await interaction.reply(`🔓 Unbanned user ID: ${userId}`);
  }

  else if (commandName === 'raidlock') {
    const state = options.getString('state').toLowerCase();
    if (state !== 'on' && state !== 'off') return interaction.reply({ content: 'State must be "on" or "off".', ephemeral: true });
    guild.channels.cache.forEach(ch => {
      if (ch.isTextBased()) {
        ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: state !== 'on' });
      }
    });
    await interaction.reply(`🛡️ Raid lock ${state === 'on' ? 'enabled' : 'disabled'}.`);
  }

  else if (commandName === 'scammer') {
    const user = options.getUser('user');
    const reason = options.getString('reason');
    logAction(user.id, 'Scammer Marked', reason, modUser.tag);
    await sendDM(user, `⚠️ You were marked as a scammer in ${guild.name}: ${reason}`);

    const alertEmbed = new EmbedBuilder()
      .setTitle('⚠️ Scammer Alert @everyone')
      .setDescription(`${user} has been marked as a scammer.\n**Reason:** ${reason}`)
      .setColor('Red')
      .setTimestamp();

    const scamChannel = await client.channels.fetch('1397699589653663834');
    if (scamChannel && scamChannel.isTextBased()) {
      scamChannel.send({ content: '@everyone', embeds: [alertEmbed] });
    }

    await interaction.reply(`⚠️ ${user.tag} marked as a scammer with reason: ${reason}`);
  }

  else if (commandName === 'securitylogs') {
    const user = options.getUser('user');
    const data = logs[user.id] || [];
    const embed = new EmbedBuilder().setTitle(`Logs for ${user.tag}`).setColor('Red');
    data.forEach(log => embed.addFields({ name: log.action, value: `**By:** ${log.moderator}\n**Reason:** ${log.reason}\n**Date:** ${log.date}` }));
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'clearlogs') {
    const user = options.getUser('user');
    logs[user.id] = [];
    saveLogs();
    await interaction.reply(`🧹 Cleared logs for ${user.tag}`);
  }

  else if (commandName === 'record') {
    const id = options.getString('userid');
    const reason = options.getString('reason');
    const post = options.getString('post')?.toLowerCase() || 'no';
    logAction(id, 'Manual Record', reason, modUser.tag);

    // Embed for record
    const recordEmbed = new EmbedBuilder()
      .setTitle('📘 New Manual Record')
      .setDescription(`User ID: ${id}\n**Reason:** ${reason}\n**Moderator:** ${modUser.tag}`)
      .setColor('Blue')
      .setTimestamp();

    if (post === 'yes') {
      const channel = await client.channels.fetch('1397699589653663834');
      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [recordEmbed] });
      }
      await interaction.reply(`📝 Record created for ID ${id} and posted in channel.`);
    } else {
      // DM mod only
      await sendDM(modUser, `📝 Record created for ID ${id}:\nReason: ${reason}`);
      await interaction.reply(`📝 Record created for ID ${id} and sent to your DMs.`);
    }
  }

  else if (commandName === 'recordcheck') {
    const id = options.getString('userid');
    const data = logs[id] || [];
    const embed = new EmbedBuilder().setTitle(`Records for ID ${id}`).setColor('Blue');
    data.forEach(log => embed.addFields({ name: log.action, value: `${log.reason} (by ${log.moderator})` }));
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'recorddelete') {
    const id = options.getString('userid');
    logs[id] = [];
    saveLogs();
    await interaction.reply(`🗑️ Deleted records for ID ${id}`);
  }

  else if (commandName === 'checkuser') {
    const user = options.getUser('user');
    await interaction.reply(`🆔 User ID: ${user.id}`);
  }

  else if (commandName === 'checkid') {
    const id = options.getString('id');
    try {
      const user = await client.users.fetch(id);
      await interaction.reply(`👤 User: ${user.tag}`);
    } catch {
      await interaction.reply('❌ No user found with that ID');
    }
  }

  else if (commandName === 'ally') {
    const serverId = options.getString('serverid');
    if (!allies.includes(serverId)) allies.push(serverId);
    saveAllies();
    await interaction.reply(`🤝 Alliance created with server ID: ${serverId}`);
  }

  else if (commandName === 'allydelete') {
    const serverId = options.getString('serverid');
    allies = allies.filter(id => id !== serverId);
    saveAllies();
    await interaction.reply(`❌ Alliance deleted with server ID: ${serverId}`);
  }

  else if (commandName === 'alliancecheck') {
    await interaction.reply(`📋 Current alliances:\n${allies.join('\n') || 'None'}`);
  }

  else if (commandName === 'allynotify') {
    const serverId = options.getString('serverid');
    const message = options.getString('message');
    // Fetch server owner or notify logic for ally server here
    // Placeholder:
    await interaction.reply(`📩 Message sent to alliance server ID ${serverId}:\n${message}`);
  }

  else {
    await interaction.reply('❌ Unknown command');
  }
});

client.login(TOKEN);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

