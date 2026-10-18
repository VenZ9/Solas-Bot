const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { checkHierarchy } = require('../../utils/permissions');
const moderationRepo = require('../../database/repositories/moderation');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a server member')
    .addUserOption(opt => opt.setName('target').setDescription('The member to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      const hierarchy = checkHierarchy(interaction.member, targetMember, interaction.guild.members.me);
      if (!hierarchy.canAct) {
        return interaction.reply({ embeds: [errorEmbed('Hierarchy Violation', hierarchy.reason)], ephemeral: true });
      }
    }

    const warnId = moderationRepo.addWarning(interaction.guild.id, targetUser.id, interaction.user.id, reason);
    loggingService.logModAction(interaction.guild, 'WARN', interaction.user, targetUser, reason);

    const count = moderationRepo.getWarnings(interaction.guild.id, targetUser.id).length;

    return interaction.reply({
      embeds: [successEmbed('Warning Issued', `Recorded warning **#${warnId}** for <@${targetUser.id}>.\n\nReason: **${reason}**\nTotal Active Warnings: **${count}**`)],
    });
  },
};
