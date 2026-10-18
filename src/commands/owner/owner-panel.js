const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isOwner } = require('../../utils/permissions');
const { errorEmbed, panelEmbed } = require('../../utils/embeds');
const botSettingsRepo = require('../../database/repositories/botSettings');
const allowlistRepo = require('../../database/repositories/allowlist');
const { formatDuration } = require('../../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owner-panel')
    .setDescription('Access the global bot administration and runtime control center'),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed('Unauthorized', 'This command is restricted exclusively to the configured bot owner.')],
        ephemeral: true,
      });
    }

    const uptime = formatDuration(process.uptime() * 1000);
    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const isMaint = botSettingsRepo.isMaintenanceMode();
    const allowlistCount = allowlistRepo.getAllowedGuilds().length;
    const guildCount = interaction.client.guilds.cache.size;

    const embed = panelEmbed(
      'Solas Operations Control Panel',
      'System-level controls and operational state. Authorized for system owner only.'
    );

    embed.addGlassField('Maintenance Mode', isMaint ? '[ACTIVE - LOCKED]' : '[DISABLED - NORMAL]', true);
    embed.addGlassField('Heap Allocation', `${mem} MB`, true);
    embed.addGlassField('Process Uptime', uptime, true);

    embed.addGlassField('Authorized Servers', `${allowlistCount} in allowlist`, true);
    embed.addGlassField('Live Connections', `${guildCount} active guilds`, true);
    embed.addGlassField('WebSocket Status', `${interaction.client.ws.status === 0 ? '[READY]' : '[CONNECTING]'}`, true);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('owner_maintenance_toggle')
        .setLabel(isMaint ? 'Disable Maintenance' : 'Enable Maintenance')
        .setStyle(isMaint ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('owner_shutdown')
        .setLabel('Graceful Shutdown')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};
