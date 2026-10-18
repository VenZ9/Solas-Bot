const { errorEmbed, successEmbed } = require('../utils/embeds');
const moderationRepo = require('../database/repositories/moderation');
const loggingService = require('../services/loggingService');
const { checkHierarchy } = require('../utils/permissions');

async function handleModalSubmit(interaction) {
  const customId = interaction.customId;

  // Moderation panel modal actions
  if (customId === 'modal_mod_warn') {
    const targetId = interaction.fields.getTextInputValue('target_id').trim();
    const reason = interaction.fields.getTextInputValue('reason').trim();

    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('Target Not Found', 'Could not locate member in this server.')], ephemeral: true });
    }

    const hierarchy = checkHierarchy(interaction.member, targetMember, interaction.guild.members.me);
    if (!hierarchy.canAct) {
      return interaction.reply({ embeds: [errorEmbed('Hierarchy Violation', hierarchy.reason)], ephemeral: true });
    }

    const warnId = moderationRepo.addWarning(interaction.guild.id, targetId, interaction.user.id, reason);
    loggingService.logModAction(interaction.guild, 'WARN', interaction.user, targetMember.user, reason);

    return interaction.reply({
      embeds: [successEmbed('Warning Recorded', `Issued warning #${warnId} to <@${targetId}>.\n\nReason: ${reason}`)],
      ephemeral: true,
    });
  }
}

module.exports = {
  handleModalSubmit,
};
