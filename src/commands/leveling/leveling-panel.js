const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { panelEmbed } = require('../../utils/embeds');
const levelingRepo = require('../../database/repositories/leveling');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leveling-panel')
    .setDescription('Display the leveling configuration dashboard and rewards overview')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const cfg = levelingRepo.getConfig(guildId);
    const rewards = levelingRepo.getRewards(guildId);
    const top = levelingRepo.getLeaderboard(guildId, 1);

    const embed = panelEmbed(
      'Leveling System Dashboard',
      'Server XP accumulation, cooldown parameters, and automated milestone rewards.'
    );

    embed.addGlassField('Status', cfg.enabled ? '[Active]' : '[Disabled]', true);
    embed.addGlassField('XP Multiplier', `${cfg.xp_rate}x`, true);
    embed.addGlassField('Cooldown', `${cfg.cooldown_seconds}s per user`, true);

    let rewardsText = '[No Milestone Rewards Configured]';
    if (rewards.length > 0) {
      rewardsText = rewards.map(r => `• **Level ${r.level}** ➔ <@&${r.role_id}>`).join('\n');
    }
    embed.addGlassField('Level Milestone Rewards', rewardsText, false);

    const leader = top.length > 0 ? `<@${top[0].user_id}> (Level ${top[0].level} • ${top[0].xp} XP)` : '[None]';
    embed.addGlassField('Current #1 Rank', leader, false);

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
