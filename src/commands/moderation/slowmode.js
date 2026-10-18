const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { parseDuration, formatDuration } = require('../../utils/time');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode cooldown for the current or specified channel')
    .addStringOption(opt => opt.setName('duration').setDescription('Cooldown duration (e.g. 0s, 5s, 10s, 1m, 10m, 6h)').setRequired(true))
    .addChannelOption(opt => opt.setName('channel').setDescription('Target text channel (defaults to current)').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const durationInput = interaction.options.getString('duration').trim().toLowerCase();
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    let seconds = 0;
    if (durationInput !== '0' && durationInput !== '0s' && durationInput !== 'off') {
      const ms = parseDuration(durationInput);
      if (ms === null) {
        return interaction.reply({
          embeds: [errorEmbed('Invalid Duration', 'Please supply a format like `0s` (to disable), `5s`, `30s`, `1m`, or `2h`.')],
          ephemeral: true,
        });
      }
      seconds = Math.floor(ms / 1000);
    }

    const maxSlowmode = 21600; // 6 hours
    if (seconds > maxSlowmode) {
      return interaction.reply({
        embeds: [errorEmbed('Limit Exceeded', 'Discord maximum slowmode limit is 6 hours (21600 seconds).')],
        ephemeral: true,
      });
    }

    try {
      await targetChannel.setRateLimitPerUser(seconds, `Slowmode adjusted by ${interaction.user.tag}`);
      loggingService.logModAction(interaction.guild, 'SLOWMODE', interaction.user, { id: targetChannel.id, tag: targetChannel.name }, `Set to ${seconds}s`);

      const desc = seconds === 0
        ? `Slowmode has been disabled in <#${targetChannel.id}>.`
        : `Slowmode in <#${targetChannel.id}> is now set to **${formatDuration(seconds * 1000)}** per member.`;

      return interaction.reply({
        embeds: [successEmbed('Slowmode Updated', desc)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed('Configuration Failed', `Could not update slowmode: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
