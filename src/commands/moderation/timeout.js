const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { checkHierarchy } = require('../../utils/permissions');
const { parseDuration, formatDuration } = require('../../utils/time');
const moderationRepo = require('../../database/repositories/moderation');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily restrict a member from sending messages and voice activity')
    .addUserOption(opt => opt.setName('target').setDescription('The member to timeout').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d, 7d)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'Violation of server rules';

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('Member Not Found', 'Target user is not present in this server.')], ephemeral: true });
    }

    const hierarchy = checkHierarchy(interaction.member, targetMember, interaction.guild.members.me);
    if (!hierarchy.canAct) {
      return interaction.reply({ embeds: [errorEmbed('Hierarchy Violation', hierarchy.reason)], ephemeral: true });
    }

    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
      return interaction.reply({
        embeds: [errorEmbed('Invalid Duration', 'Please provide a valid format like `60s`, `10m`, `2h`, or `7d`.')],
        ephemeral: true,
      });
    }

    const maxTimeoutMs = 28 * 24 * 60 * 60 * 1000; // 28 days Discord limit
    if (durationMs > maxTimeoutMs) {
      return interaction.reply({
        embeds: [errorEmbed('Duration Exceeded', 'Discord limits member timeouts to a maximum of 28 days.')],
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(durationMs, `${reason} (Staff: ${interaction.user.tag})`);
      const formatted = formatDuration(durationMs);

      moderationRepo.logAction(interaction.guild.id, targetUser.id, interaction.user.id, 'TIMEOUT', reason, Math.floor(durationMs / 1000));
      loggingService.logModAction(interaction.guild, 'TIMEOUT', interaction.user, targetUser, reason, formatted);

      return interaction.reply({
        embeds: [successEmbed('Member Timed Out', `Applied timeout to <@${targetUser.id}> for **${formatted}**.\n\nReason: **${reason}**`)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed('Timeout Failed', `Could not apply timeout: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
