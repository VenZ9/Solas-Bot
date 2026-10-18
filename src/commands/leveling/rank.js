const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');
const levelingRepo = require('../../database/repositories/leveling');

function createProgressBar(current, target, length = 16) {
  if (target <= 0) return '[' + '='.repeat(length) + ']';
  const ratio = Math.min(Math.max(current / target, 0), 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return '[' + '='.repeat(filled) + '-'.repeat(empty) + ']';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Inspect your current leveling rank, XP progress, and level tier')
    .addUserOption(opt => opt.setName('user').setDescription('Target user (defaults to yourself)').setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guild.id;

    const rankData = levelingRepo.getUserRank(guildId, targetUser.id);
    const currentLvlXp = levelingRepo.getXpForLevel(rankData.level);
    const nextLvlXp = levelingRepo.getXpForLevel(rankData.level + 1);

    const xpInLevel = rankData.xp - currentLvlXp;
    const xpNeededForLevel = nextLvlXp - currentLvlXp;

    const bar = createProgressBar(xpInLevel, xpNeededForLevel, 14);

    const embed = infoEmbed(
      `Rank Profile :: ${targetUser.tag}`,
      `Overview of XP progression and server standing for <@${targetUser.id}>.`
    );

    embed.addGlassField('Server Rank', `#${rankData.rank}`, true);
    embed.addGlassField('Level', `${rankData.level}`, true);
    embed.addGlassField('Total XP', `${rankData.xp}`, true);

    embed.addGlassField('Level Progress', `\`${bar}\`\n${xpInLevel} / ${xpNeededForLevel} XP to Level ${rankData.level + 1}`, false);

    return interaction.reply({ embeds: [embed] });
  },
};
