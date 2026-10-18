const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { checkHierarchy } = require('../../utils/permissions');
const moderationRepo = require('../../database/repositories/moderation');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove an active timeout restriction from a member')
    .addUserOption(opt => opt.setName('target').setDescription('The member to remove timeout from').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for removing timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'Timeout lifted by staff';

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('Member Not Found', 'Target user is not present in this server.')], ephemeral: true });
    }

    const hierarchy = checkHierarchy(interaction.member, targetMember, interaction.guild.members.me);
    if (!hierarchy.canAct) {
      return interaction.reply({ embeds: [errorEmbed('Hierarchy Violation', hierarchy.reason)], ephemeral: true });
    }

    if (!targetMember.communicationDisabledUntilTimestamp || targetMember.communicationDisabledUntilTimestamp < Date.now()) {
      return interaction.reply({
        embeds: [errorEmbed('No Active Timeout', `<@${targetUser.id}> does not have an active timeout restriction.`)],
        ephemeral: true,
      });
    }

    try {
      await targetMember.timeout(null, `${reason} (Staff: ${interaction.user.tag})`);
      moderationRepo.logAction(interaction.guild.id, targetUser.id, interaction.user.id, 'UNTIMEOUT', reason);
      loggingService.logModAction(interaction.guild, 'UNTIMEOUT', interaction.user, targetUser, reason);

      return interaction.reply({
        embeds: [successEmbed('Timeout Removed', `Successfully lifted timeout for <@${targetUser.id}>.\n\nReason: **${reason}**`)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed('Action Failed', `Could not lift timeout: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
