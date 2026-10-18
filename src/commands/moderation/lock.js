const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel to prevent regular members from sending messages')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock (defaults to current)').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for locking the channel').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'Emergency channel lockdown';

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false,
      }, { reason: `Locked by ${interaction.user.tag}: ${reason}` });

      loggingService.logModAction(interaction.guild, 'LOCK', interaction.user, { id: channel.id, tag: channel.name }, reason);

      return interaction.reply({
        embeds: [successEmbed('Channel Locked', `Channel <#${channel.id}> is now locked.\n\nReason: **${reason}**`)],
      });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed('Lock Failed', `Could not update permissions: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
