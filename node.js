// Install required packages with: npm install discord.js fs dotenv
const { Client, GatewayIntentBits, Partials, PermissionsBitField, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

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

// Slash command for /securitylogs
client.on('ready', async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName('securitylogs')
      .setDescription('View logs for a user')
      .addUserOption(option =>
        option.setName('user')
              .setDescription('User to view logs for')
              .setRequired(true))
      .toJSON()
  ];
  
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log(`✅ RoSecurity bot is online as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'securitylogs') {
    const user = interaction.options.getUser('user');
    const data = logs[user.id] || [];
    if (data.length === 0) {
      return interaction.reply({ content: `No logs for ${user.tag}.`, ephemeral: true });
    }

    const entries = data.map((log, i) =>
      `**${i + 1}.** [${log.date}] - **${log.action}** by ${log.moderator} — ${log.reason}`
    ).join('\n');

    interaction.reply({ content: `Logs for **${user.tag}**:\n${entries}`, ephemeral: true });
  }
});

client.on('messageCreate', async message => {
  if (!message.content.startsWith('?') || message.author.bot) return;
  const [cmd, ...args] = message.content.slice(1).split(' ');
  const member = message.member;

  // Permission check
  const hasModPerms = member.permissions.has(PermissionsBitField.Flags.ModerateMembers);

  if (!hasModPerms && cmd !== 'help') return;

  const mentioned = message.mentions.members.first();

  switch (cmd.toLowerCase()) {
    case 'ban':
      if (mentioned) {
        const reason = args.slice(1).join(' ') || 'No reason';
        await mentioned.ban({ reason });
        logAction(mentioned.id, 'Ban', reason, message.author.tag);
        message.reply(`${mentioned.user.tag} was banned.`);
      }
      break;

    case 'kick':
      if (mentioned) {
        const reason = args.slice(1).join(' ') || 'No reason';
        await mentioned.kick(reason);
        logAction(mentioned.id, 'Kick', reason, message.author.tag);
        message.reply(`${mentioned.user.tag} was kicked.`);
      }
      break;

    case 'mute':
      if (mentioned) {
        const reason = args.slice(1).join(' ') || 'No reason';
        await mentioned.timeout(10 * 60 * 1000, reason); // 10 minute mute
        logAction(mentioned.id, 'Mute', reason, message.author.tag);
        message.reply(`${mentioned.user.tag} was muted.`);
      }
      break;

    case 'warn':
      if (mentioned) {
        const reason = args.slice(1).join(' ') || 'No reason';
        logAction(mentioned.id, 'Warn', reason, message.author.tag);
        message.reply(`${mentioned.user.tag} was warned.`);
      }
      break;

    case 'raidlock':
      const channels = message.guild.channels.cache.filter(ch => ch.isTextBased());
      channels.forEach(ch => ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }));
      message.reply('🔒 Server is now in raid lock.');
      break;

    case 'massban':
      const ids = args.join(' ').split(',').map(id => id.trim());
      ids.forEach(async id => {
        try {
          await message.guild.members.ban(id, { reason: 'Massban by ' + message.author.tag });
          logAction(id, 'Massban', 'Massban command', message.author.tag);
        } catch (e) {
          message.channel.send(`Failed to ban ${id}`);
        }
      });
      message.reply(`🔨 Attempted to ban ${ids.length} users.`);
      break;

    default:
      break;
  }
});

client.login(process.env.TOKEN);
