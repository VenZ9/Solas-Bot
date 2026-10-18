const { SlashCommandBuilder } = require('discord.js');
const os = require('os');
const { formatDuration } = require('../../utils/time');
const { infoEmbed } = require('../../utils/embeds');
const { getDatabase } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Display system specifications, resource utilization, and bot diagnostics'),

  async execute(interaction) {
    const uptime = formatDuration(process.uptime() * 1000);
    const mem = process.memoryUsage();
    const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(2);
    const rssMb = (mem.rss / 1024 / 1024).toFixed(2);

    const client = interaction.client;
    const guildCount = client.guilds.cache.size;
    const userCount = client.users.cache.size;

    let sqliteVersion = 'Unknown';
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT sqlite_version() as ver').get();
      sqliteVersion = row.ver;
    } catch {}

    const embed = infoEmbed(
      'System Architecture & Diagnostics',
      'Engineered for 512MB shared hosting profiles with high-efficiency SQLite WAL persistence.'
    );

    embed.addGlassField('Runtime', `Node.js ${process.version}`, true);
    embed.addGlassField('Discord.js', `v${require('discord.js').version}`, true);
    embed.addGlassField('SQLite Version', `v${sqliteVersion}`, true);

    embed.addGlassField('Heap Used', `${heapUsedMb} MB`, true);
    embed.addGlassField('Process RSS', `${rssMb} MB`, true);
    embed.addGlassField('System Uptime', uptime, true);

    embed.addGlassField('Connected Guilds', `${guildCount}`, true);
    embed.addGlassField('Cached Members', `${userCount}`, true);
    embed.addGlassField('Platform', `${os.type()} (${os.arch()})`, true);

    return interaction.reply({ embeds: [embed] });
  },
};
