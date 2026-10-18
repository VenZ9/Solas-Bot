const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { errorEmbed, successEmbed, infoEmbed } = require('../../utils/embeds');
const automodRepo = require('../../database/repositories/automod');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure mass-mention detection and spam/flood prevention filters')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View current automod filter configurations and exemptions')
    )
    .addSubcommand(sub =>
      sub
        .setName('mentions')
        .setDescription('Configure mass-mention detection threshold and automated action')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable mention protection').setRequired(true))
        .addIntegerOption(opt => opt.setName('threshold').setDescription('Max mentions permitted per message').setMinValue(2).setMaxValue(50).setRequired(true))
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Enforcement action')
            .setRequired(true)
            .addChoices(
              { name: 'Delete Message Only', value: 'delete' },
              { name: 'Delete and Timeout Member', value: 'timeout' }
            )
        )
        .addIntegerOption(opt => opt.setName('timeout_seconds').setDescription('Timeout duration in seconds (if action is timeout)').setMinValue(10).setMaxValue(86400).setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('spam')
        .setDescription('Configure message velocity and flood prevention')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable spam/flood filter').setRequired(true))
        .addIntegerOption(opt => opt.setName('messages').setDescription('Max messages allowed in window').setMinValue(3).setMaxValue(30).setRequired(true))
        .addIntegerOption(opt => opt.setName('seconds').setDescription('Evaluation window size in seconds').setMinValue(2).setMaxValue(30).setRequired(true))
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Enforcement action')
            .setRequired(true)
            .addChoices(
              { name: 'Delete Message Only', value: 'delete' },
              { name: 'Delete and Timeout Member', value: 'timeout' }
            )
        )
        .addIntegerOption(opt => opt.setName('timeout_seconds').setDescription('Timeout duration in seconds').setMinValue(10).setMaxValue(86400).setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('exempt-role')
        .setDescription('Add or remove an exempt role from automod evaluation')
        .addStringOption(opt =>
          opt.setName('operation')
            .setDescription('Add or remove exemption')
            .setRequired(true)
            .addChoices({ name: 'Add Exemption', value: 'add' }, { name: 'Remove Exemption', value: 'remove' })
        )
        .addRoleOption(opt => opt.setName('role').setDescription('Role to exempt or unexempt').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('exempt-channel')
        .setDescription('Add or remove an exempt channel from automod evaluation')
        .addStringOption(opt =>
          opt.setName('operation')
            .setDescription('Add or remove exemption')
            .setRequired(true)
            .addChoices({ name: 'Add Exemption', value: 'add' }, { name: 'Remove Exemption', value: 'remove' })
        )
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to exempt or unexempt').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Quickly disable specific automod protections')
        .addStringOption(opt =>
          opt.setName('feature')
            .setDescription('Feature to disable')
            .setRequired(true)
            .addChoices(
              { name: 'Mass Mentions', value: 'mentions' },
              { name: 'Spam / Flood', value: 'spam' },
              { name: 'All Automod', value: 'all' }
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'status') {
      const cfg = automodRepo.getConfig(guildId);
      const embed = infoEmbed('Automod System Status', 'Real-time configuration for mass-mentions and rapid spam detection.');

      const mentionStatus = cfg.mentions_enabled
        ? `[Active] Threshold: ${cfg.mention_threshold} mentions | Action: ${cfg.mention_action} (${cfg.mention_duration}s)`
        : '[Disabled]';
      embed.addGlassField('Mass Mentions Protection', mentionStatus, false);

      const spamStatus = cfg.spam_enabled
        ? `[Active] Velocity: ${cfg.spam_messages} msgs in ${cfg.spam_seconds}s | Action: ${cfg.spam_action} (${cfg.spam_duration}s)`
        : '[Disabled]';
      embed.addGlassField('Spam & Flood Prevention', spamStatus, false);

      const roles = cfg.exempt_roles.length > 0
        ? cfg.exempt_roles.map(id => `<@&${id}>`).join(', ')
        : '[None Configured]';
      embed.addGlassField('Exempt Roles', roles, false);

      const channels = cfg.exempt_channels.length > 0
        ? cfg.exempt_channels.map(id => `<#${id}>`).join(', ')
        : '[None Configured]';
      embed.addGlassField('Exempt Channels', channels, false);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'mentions') {
      const enabled = interaction.options.getBoolean('enabled');
      const threshold = interaction.options.getInteger('threshold');
      const action = interaction.options.getString('action');
      const duration = interaction.options.getInteger('timeout_seconds') || 300;

      automodRepo.updateMentions(guildId, enabled, threshold, action, duration);
      loggingService.logConfigChange(interaction.guild, interaction.user, 'automod_mentions', 'updated', `${enabled ? 'ON' : 'OFF'} (threshold: ${threshold})`);

      return interaction.reply({
        embeds: [successEmbed('Mention Protection Updated', `Mass-mention filter is now **${enabled ? 'ENABLED' : 'DISABLED'}**.\n\nThreshold: **${threshold} mentions**\nAction: **${action.toUpperCase()}**\nTimeout: **${duration}s**`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'spam') {
      const enabled = interaction.options.getBoolean('enabled');
      const messages = interaction.options.getInteger('messages');
      const seconds = interaction.options.getInteger('seconds');
      const action = interaction.options.getString('action');
      const duration = interaction.options.getInteger('timeout_seconds') || 300;

      automodRepo.updateSpam(guildId, enabled, messages, seconds, action, duration);
      loggingService.logConfigChange(interaction.guild, interaction.user, 'automod_spam', 'updated', `${enabled ? 'ON' : 'OFF'} (${messages} in ${seconds}s)`);

      return interaction.reply({
        embeds: [successEmbed('Spam Prevention Updated', `Spam/flood filter is now **${enabled ? 'ENABLED' : 'DISABLED'}**.\n\nVelocity: **${messages} messages per ${seconds} seconds**\nAction: **${action.toUpperCase()}**\nTimeout: **${duration}s**`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'exempt-role') {
      const op = interaction.options.getString('operation');
      const role = interaction.options.getRole('role');

      if (op === 'add') {
        automodRepo.addExemptRole(guildId, role.id);
        return interaction.reply({
          embeds: [successEmbed('Exemption Added', `Role <@&${role.id}> is now exempt from automod checks.`)],
          ephemeral: true,
        });
      } else {
        automodRepo.removeExemptRole(guildId, role.id);
        return interaction.reply({
          embeds: [successEmbed('Exemption Removed', `Removed role <@&${role.id}> from the automod exemption list.`)],
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'exempt-channel') {
      const op = interaction.options.getString('operation');
      const channel = interaction.options.getChannel('channel');

      if (op === 'add') {
        automodRepo.addExemptChannel(guildId, channel.id);
        return interaction.reply({
          embeds: [successEmbed('Channel Exemption Added', `Channel <#${channel.id}> is now exempt from automod checks.`)],
          ephemeral: true,
        });
      } else {
        automodRepo.removeExemptChannel(guildId, channel.id);
        return interaction.reply({
          embeds: [successEmbed('Channel Exemption Removed', `Removed channel <#${channel.id}> from the automod exemption list.`)],
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'disable') {
      const feature = interaction.options.getString('feature');
      automodRepo.disableFeature(guildId, feature);
      loggingService.logConfigChange(interaction.guild, interaction.user, 'automod_disable', feature, 'DISABLED');

      return interaction.reply({
        embeds: [successEmbed('Filter Disabled', `Successfully disabled **${feature.toUpperCase()}** automod protection.`)],
        ephemeral: true,
      });
    }
  },
};
