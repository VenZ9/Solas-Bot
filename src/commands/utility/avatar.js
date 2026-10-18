const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display high-resolution profile avatar for a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user (defaults to yourself)').setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });

    const embed = infoEmbed(
      `Avatar :: ${targetUser.tag}`,
      `[Download High-Resolution Image](${avatarUrl})`
    );
    embed.setImage(avatarUrl);

    return interaction.reply({ embeds: [embed] });
  },
};
