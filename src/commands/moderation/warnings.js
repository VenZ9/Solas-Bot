const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, infoEmbed } = require('../../utils/embeds');
const moderationRepo = require('../../database/repositories/moderation');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View, clear, or remove individual warnings for members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View all warnings issued to a member')
        .addUserOption(opt => opt.setName('user').setDescription('The user whose warnings to inspect').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Clear all recorded warnings for a member')
        .addUserOption(opt => opt.setName('user').setDescription('The user whose warnings to clear').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a single specific warning by its ID')
        .addIntegerOption(opt => opt.setName('warn_id').setDescription('The warning ID to remove').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      const user = interaction.options.getUser('user');
      const warnings = moderationRepo.getWarnings(interaction.guild.id, user.id);

      if (warnings.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Warning Records', `<@${user.id}> has zero recorded warnings.`)],
        });
      }

      const list = warnings.map(w => {
        const time = Math.floor(w.created_at / 1000);
        return `• **[#${w.id}]** <t:${time}:d> by <@${w.moderator_id}>\n  Reason: ${w.reason}`;
      }).join('\n\n');

      const embed = infoEmbed(`Warnings for ${user.tag}`, `Total Warnings: **${warnings.length}**\n\n${list}`);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'clear') {
      const user = interaction.options.getUser('user');
      const result = moderationRepo.clearWarnings(interaction.guild.id, user.id);

      loggingService.logModAction(interaction.guild, 'CLEAR_WARNINGS', interaction.user, user, 'Cleared all recorded warnings');

      return interaction.reply({
        embeds: [successEmbed('Warnings Cleared', `Successfully purged all (${result.changes}) warning records for <@${user.id}>.`)],
      });
    }

    if (subcommand === 'remove') {
      const warnId = interaction.options.getInteger('warn_id');
      const warning = moderationRepo.getWarningById(interaction.guild.id, warnId);

      if (!warning) {
        return interaction.reply({
          embeds: [errorEmbed('Warning Not Found', `No warning with ID **#${warnId}** exists for this server.`)],
          ephemeral: true,
        });
      }

      moderationRepo.removeWarning(interaction.guild.id, warnId);
      loggingService.logModAction(interaction.guild, 'REMOVE_WARNING', interaction.user, { id: warning.user_id }, `Removed warning #${warnId}`);

      return interaction.reply({
        embeds: [successEmbed('Warning Removed', `Successfully deleted warning **#${warnId}** from member <@${warning.user_id}>.`)],
      });
    }
  },
};
