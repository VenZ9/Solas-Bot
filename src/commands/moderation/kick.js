const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { errorEmbed, warningEmbed } = require('../../utils/embeds');
const { checkHierarchy } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server with confirmation verification')
    .addUserOption(opt => opt.setName('target').setDescription('The member to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason specified';

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('Member Not Found', 'Target user is not present in this server.')], ephemeral: true });
    }

    const hierarchy = checkHierarchy(interaction.member, targetMember, interaction.guild.members.me);
    if (!hierarchy.canAct) {
      return interaction.reply({ embeds: [errorEmbed('Hierarchy Violation', hierarchy.reason)], ephemeral: true });
    }

    // Confirmation step
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mod_confirm:kick:${targetUser.id}:${interaction.user.id}`)
        .setLabel('Confirm Kick')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`mod_cancel:kick:${targetUser.id}:${interaction.user.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = warningEmbed(
      'Kick Confirmation Required',
      `Are you sure you want to kick <@${targetUser.id}> (${targetUser.tag}) from the server?\n\nReason: **${reason}**`
    );

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};
