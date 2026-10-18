const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { panelEmbed } = require('../../utils/embeds');
const moderationRepo = require('../../database/repositories/moderation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moderation-panel')
    .setDescription('Display the interactive moderation management interface')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const guild = interaction.guild;
    const recent = moderationRepo.getRecentActions(guild.id, 5);

    let recentSummary = 'No recent moderation events logged.';
    if (recent.length > 0) {
      recentSummary = recent.map(r => {
        const time = Math.floor(r.created_at / 1000);
        return `• <t:${time}:R> | **${r.action_type}** on <@${r.user_id}> by <@${r.moderator_id}>`;
      }).join('\n');
    }

    const embed = panelEmbed(
      'Moderation Control Center',
      `Welcome to the Solas Server Moderation Panel.\n\nUse slash commands for direct actions, or access quick moderation tools below.\n\n**Recent Server Sanctions:**\n${recentSummary}`
    );

    embed.addGlassField('Available Controls', 'Ban, Kick, Timeout, Warn, Warnings Management, Slowmode, Purge, Channel Lock', false);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mod_panel_warn')
        .setLabel('Issue Warning')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('mod_panel_refresh')
        .setLabel('Refresh Sanctions')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};
