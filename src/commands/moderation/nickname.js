const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { checkHierarchy } = require('../../utils/permissions');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Change or reset the server nickname for a member')
    .addUserOption(opt => opt.setName('target').setDescription('The member to modify').setRequired(true))
    .addStringOption(opt => opt.setName('nickname').setDescription('New nickname (leave empty to reset to default)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const newNickname = interaction.options.getString('nickname');

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('Member Not Found', 'Target user is not present in this server.')], ephemeral: true });
    }

    const hierarchy = checkHierarchy(interaction.member, targetMember, interaction.guild.members.me);
    if (!hierarchy.canAct) {
      return interaction.reply({ embeds: [errorEmbed('Hierarchy Violation', hierarchy.reason)], ephemeral: true });
    }

    if (newNickname && newNickname.length > 32) {
      return interaction.reply({
        embeds: [errorEmbed('Length Exceeded', 'Discord nicknames are limited to a maximum of 32 characters.')],
        ephemeral: true,
      });
    }

    try {
      await targetMember.setNickname(newNickname || null, `Modified by ${interaction.user.tag}`);
      loggingService.logModAction(interaction.guild, 'NICKNAME', interaction.user, targetUser, newNickname ? `Changed to "${newNickname}"` : 'Reset to default');

      const desc = newNickname
        ? `Updated nickname for <@${targetUser.id}> to **${newNickname}**.`
        : `Reset nickname for <@${targetUser.id}> to their original username.`;

      return interaction.reply({
        embeds: [successEmbed('Nickname Modified', desc)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed('Modification Failed', `Could not update nickname: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
