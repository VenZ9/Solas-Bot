const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { errorEmbed, successEmbed, panelEmbed, infoEmbed } = require('../../utils/embeds');
const loggingRepo = require('../../database/repositories/logging');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Configure server audit logging channels and independent per-event toggles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('dashboard')
        .setDescription('View the full logging dashboard and status of all event trackers')
    )
    .addSubcommand(sub =>
      sub
        .setName('channel')
        .setDescription('Set the primary audit logging output channel')
        .addChannelOption(opt => opt.setName('target').setDescription('Target text channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable logging for a specific event category')
        .addStringOption(opt =>
          opt.setName('event')
            .setDescription('Event category to toggle')
            .setRequired(true)
            .addChoices(
              { name: 'Message Edits', value: 'edits' },
              { name: 'Message Deletes', value: 'deletes' },
              { name: 'Member Joins', value: 'joins' },
              { name: 'Member Leaves', value: 'leaves' },
              { name: 'Role Changes', value: 'roles' },
              { name: 'Channel Updates', value: 'channels' },
              { name: 'Moderation Actions', value: 'mod' },
              { name: 'Ticket Lifecycles', value: 'tickets' },
              { name: 'Configuration Changes', value: 'config' }
            )
        )
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable this event').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Quick summary of logging destination and active categories')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'dashboard' || subcommand === 'status') {
      const cfg = loggingRepo.getConfig(guildId);
      const embed = panelEmbed(
        'Audit Logging Dashboard',
        'Independent per-event event dispatchers for server security and compliance.'
      );

      const chanText = cfg.channel_id ? `<#${cfg.channel_id}>` : '[No Channel Set]';
      embed.addGlassField('Output Channel', chanText, false);

      const statusMap = [
        `• Message Edits: ${cfg.log_edits ? '[ON]' : '[OFF]'}`,
        `• Message Deletions: ${cfg.log_deletes ? '[ON]' : '[OFF]'}`,
        `• Member Joins: ${cfg.log_joins ? '[ON]' : '[OFF]'}`,
        `• Member Leaves: ${cfg.log_leaves ? '[ON]' : '[OFF]'}`,
        `• Role Modifications: ${cfg.log_roles ? '[ON]' : '[OFF]'}`,
        `• Channel Updates: ${cfg.log_channels ? '[ON]' : '[OFF]'}`,
        `• Moderation Actions: ${cfg.log_mod ? '[ON]' : '[OFF]'}`,
        `• Support Tickets: ${cfg.log_tickets ? '[ON]' : '[OFF]'}`,
        `• Bot Configurations: ${cfg.log_config ? '[ON]' : '[OFF]'}`,
      ].join('\n');

      embed.addGlassField('Event Category Toggles', statusMap, false);

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    if (subcommand === 'channel') {
      const targetChan = interaction.options.getChannel('target');
      loggingRepo.setChannel(guildId, targetChan.id);
      loggingService.logConfigChange(interaction.guild, interaction.user, 'logging_channel', 'updated', targetChan.name);

      return interaction.reply({
        embeds: [successEmbed('Audit Channel Set', `Audit logs will now be broadcast to <#${targetChan.id}>.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'toggle') {
      const eventName = interaction.options.getString('event');
      const enabled = interaction.options.getBoolean('enabled');

      loggingRepo.setToggle(guildId, eventName, enabled);
      loggingService.logConfigChange(interaction.guild, interaction.user, `log_toggle_${eventName}`, 'updated', enabled ? 'ON' : 'OFF');

      return interaction.reply({
        embeds: [successEmbed('Toggle Updated', `Audit logging for **${eventName.toUpperCase()}** is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)],
        ephemeral: true,
      });
    }
  },
};
