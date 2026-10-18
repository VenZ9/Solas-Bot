const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Inspect detailed account and server profile data for a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user (defaults to yourself)').setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const createdUnix = Math.floor(targetUser.createdTimestamp / 1000);
    const joinedUnix = member ? Math.floor(member.joinedTimestamp / 1000) : null;

    const embed = infoEmbed(
      `User Profile :: ${targetUser.tag}`,
      `Security profile and membership data for <@${targetUser.id}>.`
    );

    embed.addGlassField('User ID', `\`${targetUser.id}\``, true);
    embed.addGlassField('Account Type', targetUser.bot ? 'Bot Application' : 'Human Account', true);
    embed.addGlassField('Created Account', `<t:${createdUnix}:d> (<t:${createdUnix}:R>)`, false);

    if (member) {
      embed.addGlassField('Joined Server', `<t:${joinedUnix}:d> (<t:${joinedUnix}:R>)`, false);
      embed.addGlassField('Highest Role', `<@&${member.roles.highest.id}>`, true);

      const roles = member.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .map(r => `<@&${r.id}>`)
        .slice(0, 15);

      const rolesText = roles.length > 0 ? roles.join(', ') : '[No Custom Roles]';
      embed.addGlassField('Assigned Roles', rolesText, false);
    }

    if (targetUser.displayAvatarURL()) {
      embed.setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }));
    }

    return interaction.reply({ embeds: [embed] });
  },
};
