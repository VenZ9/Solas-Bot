const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { canManageRole } = require('../../utils/permissions');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Assign or remove server roles for members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Assign a role to a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to grant').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a role from a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('Member Not Found', 'Target user is not present in this server.')], ephemeral: true });
    }

    const check = canManageRole(interaction.member, interaction.guild.members.me, role);
    if (!check.canAct) {
      return interaction.reply({ embeds: [errorEmbed('Role Hierarchy Restriction', check.reason)], ephemeral: true });
    }

    try {
      if (subcommand === 'add') {
        if (targetMember.roles.cache.has(role.id)) {
          return interaction.reply({
            embeds: [errorEmbed('Role Already Present', `<@${targetUser.id}> already holds the role **${role.name}**.`)],
            ephemeral: true,
          });
        }

        await targetMember.roles.add(role.id, `Role added by ${interaction.user.tag}`);
        loggingService.logModAction(interaction.guild, 'ROLE_ADD', interaction.user, targetUser, `Added role ${role.name}`);

        return interaction.reply({
          embeds: [successEmbed('Role Assigned', `Granted role **${role.name}** to <@${targetUser.id}>.`)],
        });
      }

      if (subcommand === 'remove') {
        if (!targetMember.roles.cache.has(role.id)) {
          return interaction.reply({
            embeds: [errorEmbed('Role Not Held', `<@${targetUser.id}> does not possess the role **${role.name}**.`)],
            ephemeral: true,
          });
        }

        await targetMember.roles.remove(role.id, `Role removed by ${interaction.user.tag}`);
        loggingService.logModAction(interaction.guild, 'ROLE_REMOVE', interaction.user, targetUser, `Removed role ${role.name}`);

        return interaction.reply({
          embeds: [successEmbed('Role Removed', `Revoked role **${role.name}** from <@${targetUser.id}>.`)],
        });
      }
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed('Operation Failed', `Could not modify roles: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
