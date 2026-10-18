const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Measure Discord Gateway heartbeat and REST round-trip response latency'),

  async execute(interaction) {
    const startTimestamp = Date.now();
    await interaction.deferReply();
    const roundTripMs = Date.now() - startTimestamp;
    const wsPing = interaction.client.ws.ping;

    const embed = infoEmbed(
      'Latency Diagnostics',
      'Accurate measurements of WebSocket heartbeat and REST endpoint round-trip delays.'
    );

    embed.addGlassField('Gateway WebSocket Latency', `${wsPing >= 0 ? wsPing : 0} ms`, true);
    embed.addGlassField('REST Round-Trip Latency', `${roundTripMs} ms`, true);
    embed.addGlassField('Status', wsPing < 150 ? '[Optimal]' : '[Degraded]', true);

    return interaction.editReply({ embeds: [embed] });
  },
};
