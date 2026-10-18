const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');
const levelingRepo = require('../../database/repositories/leveling');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server XP and level leaderboard rankings')
    .addIntegerOption(opt => opt.setName('page').setDescription('Leaderboard page number (default: 1)').setMinValue(1).setRequired(false)),

  async execute(interaction) {
    const page = interaction.options.getInteger('page') || 1;
    const pageSize = 10;
    const offset = (page - 1) * pageSize;
    const guildId = interaction.guild.id;

    const top = levelingRepo.getLeaderboard(guildId, pageSize, offset);

    if (top.length === 0) {
      return interaction.reply({
        embeds: [infoEmbed('Leaderboard', `No leaderboard records found for page ${page}.`)],
      });
    }

    const lines = top.map((entry, idx) => {
      const rankNum = offset + idx + 1;
      return `\`#${String(rankNum).padEnd(2, ' ')}\` <@${entry.user_id}> ➔ Level **${entry.level}** (${entry.xp} XP)`;
    }).join('\n');

    const embed = infoEmbed(`Server Leaderboard :: Page ${page}`, `Top members ordered by total earned experience points:\n\n${lines}`);

    return interaction.reply({ embeds: [embed] });
  },
};
