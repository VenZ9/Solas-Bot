const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const moderationRepo = require('../../database/repositories/moderation');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Safely unban a previously banned user by their Discord User ID')
    .addStringOption(opt => opt.setName('user_id').setDescription('The Discord User ID to unban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id').trim();
    const reason = interaction.options.getString('reason') || 'Revocation requested by staff';

    // Validate snowflake format
    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({
        embeds: [errorEmbed('Invalid User ID', 'The provided ID does not match a valid Discord snowflake format (17-20 digits).')],
        ephemeral: true,
      });
    }

    try {
      const banInfo = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (!banInfo) {
        return interaction.reply({
          embeds: [errorEmbed('User Not Banned', `No active ban record was found for user ID \`${userId}\`.`)],
          ephemeral: true,
        });
      }

      await interaction.guild.bans.remove(userId, `${reason} (Staff: ${interaction.user.tag})`);
      moderationRepo.logAction(interaction.guild.id, userId, interaction.user.id, 'UNBAN', reason);
      loggingService.logModAction(interaction.guild, 'UNBAN', interaction.user, { id: userId, tag: banInfo.user.tag }, reason);

      return interaction.reply({
        embeds: [successEmbed('Member Unbanned', `Successfully revoked ban for <@${userId}> (${banInfo.user.tag}).\n\nReason: **${reason}**`)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed('Unban Failed', `Could not complete unban operation: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
