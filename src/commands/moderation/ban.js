const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { errorEmbed, warningEmbed } = require('../../utils/embeds');
const { checkHierarchy } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server with confirmation verification')
    .addUserOption(opt => opt.setName('target').setDescription('The user to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .addIntegerOption(opt => opt.setName('delete_days').setDescription('Days of message history to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason specified';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (targetMember) {
      const hierarchy = checkHierarchy(interaction.member, targetMember, interaction.guild.members.me);
      if (!hierarchy.canAct) {
        return interaction.reply({ embeds: [errorEmbed('Hierarchy Violation', hierarchy.reason)], ephemeral: true });
      }
    }

    // Confirmation step for destructive action
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mod_confirm:ban:${targetUser.id}:${interaction.user.id}`)
        .setLabel('Confirm Ban')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`mod_cancel:ban:${targetUser.id}:${interaction.user.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = warningEmbed(
      'Ban Confirmation Required',
      `Are you sure you want to ban user <@${targetUser.id}> (${targetUser.tag}) from the server?\n\nReason: **${reason}**\nMessage History Deletion: **${deleteDays} days**`
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};
