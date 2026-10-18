const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display detailed statistics and metadata for the current server'),

  async execute(interaction) {
    const guild = interaction.guild;
    const createdUnix = Math.floor(guild.createdTimestamp / 1000);
    const owner = await guild.fetchOwner().catch(() => null);

    const channels = guild.channels.cache;
    const textCount = channels.filter(c => c.isTextBased()).size;
    const voiceCount = channels.filter(c => c.isVoiceBased()).size;
    const categoryCount = channels.filter(c => c.type === 4).size;

    const rolesCount = guild.roles.cache.size;

    const embed = infoEmbed(
      `Server Metadata :: ${guild.name}`,
      `Overview of server configurations, member counts, and structural hierarchy.`
    );

    embed.addGlassField('Server ID', `\`${guild.id}\``, true);
    embed.addGlassField('Owner', owner ? `<@${owner.id}> (${owner.user.tag})` : `\`${guild.ownerId}\``, true);
    embed.addGlassField('Created On', `<t:${createdUnix}:d> (<t:${createdUnix}:R>)`, true);

    embed.addGlassField('Total Members', `${guild.memberCount}`, true);
    embed.addGlassField('Total Roles', `${rolesCount}`, true);
    embed.addGlassField('Verification Level', `${guild.verificationLevel}`, true);

    embed.addGlassField('Channels Breakdown', `Text: ${textCount} | Voice: ${voiceCount} | Categories: ${categoryCount}`, false);

    if (guild.iconURL()) {
      embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
    }

    return interaction.reply({ embeds: [embed] });
  },
};
