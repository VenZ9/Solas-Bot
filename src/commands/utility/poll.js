const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { parseDuration, formatDuration } = require('../../utils/time');
const { GlassEmbed, errorEmbed } = require('../../utils/embeds');
const { COLORS, TAGS } = require('../../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Launch an interactive button-based opinion poll')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(opt => opt.setName('option1').setDescription('First option').setRequired(true))
    .addStringOption(opt => opt.setName('option2').setDescription('Second option').setRequired(true))
    .addStringOption(opt => opt.setName('option3').setDescription('Third option').setRequired(false))
    .addStringOption(opt => opt.setName('option4').setDescription('Fourth option').setRequired(false))
    .addStringOption(opt => opt.setName('option5').setDescription('Fifth option').setRequired(false))
    .addStringOption(opt => opt.setName('duration').setDescription('Poll active duration (e.g. 5m, 1h, 1d) - default: 1h').setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const durationInput = interaction.options.getString('duration') || '1h';

    const durationMs = parseDuration(durationInput);
    if (!durationMs || durationMs < 30000 || durationMs > 7 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        embeds: [errorEmbed('Invalid Duration', 'Poll duration must be between 30 seconds and 7 days.')],
        ephemeral: true,
      });
    }

    const rawOptions = [
      interaction.options.getString('option1'),
      interaction.options.getString('option2'),
      interaction.options.getString('option3'),
      interaction.options.getString('option4'),
      interaction.options.getString('option5'),
    ].filter(Boolean);

    const votes = new Map(); // userId -> optionIndex
    const endTimestamp = Date.now() + durationMs;
    const endUnix = Math.floor(endTimestamp / 1000);

    function buildEmbed(isEnded = false) {
      const counts = new Array(rawOptions.length).fill(0);
      for (const optIdx of votes.values()) {
        counts[optIdx]++;
      }
      const totalVotes = votes.size;

      const embed = new GlassEmbed()
        .setColor(isEnded ? COLORS.NEUTRAL : COLORS.PRIMARY)
        .setGlassTitle(TAGS.SYSTEM, `Community Poll :: ${question}`);

      const optionsDesc = rawOptions.map((opt, i) => {
        const c = counts[i];
        const pct = totalVotes > 0 ? Math.round((c / totalVotes) * 100) : 0;
        return `**[${i + 1}]** ${opt}\n  Votes: **${c}** (${pct}%)`;
      }).join('\n\n');

      const footerNotice = isEnded
        ? `Poll has concluded with ${totalVotes} total votes recorded.`
        : `Closes <t:${endUnix}:R> (<t:${endUnix}:f>) • Total Votes: ${totalVotes}`;

      embed.setGlassDescription(`${optionsDesc}\n\n${footerNotice}`);
      return embed;
    }

    function buildButtons(disabled = false) {
      const row = new ActionRowBuilder();
      for (let i = 0; i < rawOptions.length; i++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_vote_${i}`)
            .setLabel(`Option ${i + 1}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
        );
      }
      return row;
    }

    const response = await interaction.reply({
      embeds: [buildEmbed(false)],
      components: [buildButtons(false)],
      fetchReply: true,
    });

    const collector = response.createMessageComponentCollector({
      time: durationMs,
    });

    collector.on('collect', async btnInteraction => {
      const optIdx = parseInt(btnInteraction.customId.replace('poll_vote_', ''), 10);
      const userId = btnInteraction.user.id;
      const prev = votes.get(userId);

      votes.set(userId, optIdx);

      const notice = prev !== undefined && prev === optIdx
        ? `You confirmed your vote for Option ${optIdx + 1}: "${rawOptions[optIdx]}".`
        : `Your vote has been cast for Option ${optIdx + 1}: "${rawOptions[optIdx]}".`;

      await btnInteraction.reply({ content: notice, ephemeral: true });
      await response.edit({ embeds: [buildEmbed(false)], components: [buildButtons(false)] }).catch(() => {});
    });

    collector.on('end', async () => {
      await response.edit({ embeds: [buildEmbed(true)], components: [buildButtons(true)] }).catch(() => {});
    });
  },
};
