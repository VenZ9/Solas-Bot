const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a previously locked channel to restore normal messaging')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock (defaults to current)').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null,
      }, { reason: `Unlocked by ${interaction.user.tag}` });

      loggingService.logModAction(interaction.guild, 'UNLOCK', interaction.user, { id: channel.id, tag: channel.name }, 'Channel lockdown lifted');

      return interaction.reply({
        embeds: [successEmbed('Channel Unlocked', `Channel <#${channel.id}> has been unlocked.`)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed('Unlock Failed', `Could not update permissions: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
