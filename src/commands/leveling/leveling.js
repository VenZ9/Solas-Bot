const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, infoEmbed } = require('../../utils/embeds');
const levelingRepo = require('../../database/repositories/leveling');
const { canManageRole } = require('../../utils/permissions');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leveling')
    .setDescription('Configure leveling rates, cooldown timers, and milestone role rewards')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup(group =>
      group
        .setName('config')
        .setDescription('Configure core leveling parameters')
        .addSubcommand(sub =>
          sub
            .setName('toggle')
            .setDescription('Enable or disable server experience accumulation')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable leveling').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('rate')
            .setDescription('Set experience multiplier (e.g. 1.0, 1.5, 2.0)')
            .addNumberOption(opt => opt.setName('multiplier').setDescription('XP rate multiplier').setMinValue(0.1).setMaxValue(10.0).setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('cooldown')
            .setDescription('Set message XP cooldown in seconds')
            .addIntegerOption(opt => opt.setName('seconds').setDescription('Cooldown in seconds').setMinValue(5).setMaxValue(3600).setRequired(true))
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('rewards')
        .setDescription('Configure milestone role rewards unlocked at specific levels')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Attach a role reward to a milestone level')
            .addIntegerOption(opt => opt.setName('level').setDescription('Target level').setMinValue(1).setMaxValue(1000).setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role to grant upon reaching level').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove a role reward for a milestone level')
            .addIntegerOption(opt => opt.setName('level').setDescription('Target level').setMinValue(1).setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('List all configured milestone level role rewards')
        )
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (group === 'config') {
      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled');
        levelingRepo.updateConfig(guild.id, { enabled });
        loggingService.logConfigChange(guild, interaction.user, 'leveling_enabled', 'updated', enabled ? 'ON' : 'OFF');

        return interaction.reply({
          embeds: [successEmbed('Leveling Configuration', `Leveling system is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)],
          ephemeral: true,
        });
      }

      if (subcommand === 'rate') {
        const rate = interaction.options.getNumber('multiplier');
        levelingRepo.updateConfig(guild.id, { xpRate: rate });
        loggingService.logConfigChange(guild, interaction.user, 'leveling_rate', 'updated', `${rate}x`);

        return interaction.reply({
          embeds: [successEmbed('XP Multiplier Updated', `Experience rate set to **${rate}x**.`)],
          ephemeral: true,
        });
      }

      if (subcommand === 'cooldown') {
        const seconds = interaction.options.getInteger('seconds');
        levelingRepo.updateConfig(guild.id, { cooldownSeconds: seconds });
        loggingService.logConfigChange(guild, interaction.user, 'leveling_cooldown', 'updated', `${seconds}s`);

        return interaction.reply({
          embeds: [successEmbed('Cooldown Updated', `XP message cooldown adjusted to **${seconds} seconds**.`)],
          ephemeral: true,
        });
      }
    }

    if (group === 'rewards') {
      if (subcommand === 'add') {
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');

        const check = canManageRole(interaction.member, guild.members.me, role);
        if (!check.canAct) {
          return interaction.reply({ embeds: [errorEmbed('Hierarchy Restriction', check.reason)], ephemeral: true });
        }

        levelingRepo.addReward(guild.id, level, role.id);
        loggingService.logConfigChange(guild, interaction.user, 'level_reward_add', `Lvl ${level}`, role.name);

        return interaction.reply({
          embeds: [successEmbed('Reward Attached', `Members who achieve **Level ${level}** will automatically receive role <@&${role.id}>.`)],
          ephemeral: true,
        });
      }

      if (subcommand === 'remove') {
        const level = interaction.options.getInteger('level');
        levelingRepo.removeReward(guild.id, level);
        loggingService.logConfigChange(guild, interaction.user, 'level_reward_remove', `Lvl ${level}`, 'REMOVED');

        return interaction.reply({
          embeds: [successEmbed('Reward Removed', `Deleted milestone reward associated with **Level ${level}**.`)],
          ephemeral: true,
        });
      }

      if (subcommand === 'list') {
        const rewards = levelingRepo.getRewards(guild.id);
        if (rewards.length === 0) {
          return interaction.reply({
            embeds: [infoEmbed('Milestone Rewards', 'No level rewards are currently configured for this server.')],
            ephemeral: true,
          });
        }

        const lines = rewards.map(r => `• **Level ${r.level}** ➔ <@&${r.role_id}>`).join('\n');
        return interaction.reply({
          embeds: [infoEmbed('Milestone Role Rewards', `Configured role rewards granted upon reaching milestones:\n\n${lines}`)],
          ephemeral: true,
        });
      }
    }
  },
};
