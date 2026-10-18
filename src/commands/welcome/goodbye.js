const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { errorEmbed, successEmbed, GlassEmbed } = require('../../utils/embeds');
const welcomeRepo = require('../../database/repositories/welcome');
const loggingService = require('../../services/loggingService');
const { TAGS, COLORS } = require('../../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('goodbye')
    .setDescription('Configure departure notifications when members leave the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable goodbye announcements')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable goodbye messages').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('set-channel')
        .setDescription('Designate the channel where goodbye messages are sent')
        .addChannelOption(opt => opt.setName('channel').setDescription('Goodbye channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('message')
        .setDescription('Set goodbye template (Placeholders: {user}, {server}, {member_count})')
        .addStringOption(opt => opt.setName('template').setDescription('Message template content').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('preview')
        .setDescription('Preview how the goodbye announcement embed will render')
    )
    .addSubcommand(sub =>
      sub
        .setName('test')
        .setDescription('Send a test goodbye message to the configured channel')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled');
      welcomeRepo.updateGoodbyeConfig(guildId, { enabled });
      loggingService.logConfigChange(interaction.guild, interaction.user, 'goodbye_enabled', 'updated', enabled ? 'ON' : 'OFF');

      return interaction.reply({
        embeds: [successEmbed('Goodbye Messages Updated', `Departure announcements are now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'set-channel') {
      const channel = interaction.options.getChannel('channel');
      welcomeRepo.updateGoodbyeConfig(guildId, { channelId: channel.id });
      loggingService.logConfigChange(interaction.guild, interaction.user, 'goodbye_channel', 'updated', channel.name);

      return interaction.reply({
        embeds: [successEmbed('Goodbye Channel Assigned', `Departure announcements will be posted in <#${channel.id}>.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'message') {
      const template = interaction.options.getString('template');
      welcomeRepo.updateGoodbyeConfig(guildId, { message: template });
      loggingService.logConfigChange(interaction.guild, interaction.user, 'goodbye_message', 'updated', template);

      return interaction.reply({
        embeds: [successEmbed('Goodbye Template Stored', `Template set to:\n\n> ${template}\n\nAvailable placeholders: \`{user}\`, \`{server}\`, \`{member_count}\``)],
        ephemeral: true,
      });
    }

    if (subcommand === 'preview' || subcommand === 'test') {
      const cfg = welcomeRepo.getGoodbyeConfig(guildId);
      const renderedText = welcomeRepo.renderTemplate(cfg.message, interaction.member);

      const embed = new GlassEmbed()
        .setColor(COLORS.WARNING)
        .setGlassTitle(TAGS.SYSTEM, 'Member Departure')
        .setGlassDescription(renderedText);

      embed.addGlassField('Remaining Members', String(interaction.guild.memberCount), true);

      if (subcommand === 'preview') {
        return interaction.reply({
          content: 'Here is a preview of the rendered goodbye embed:',
          embeds: [embed],
          ephemeral: true,
        });
      } else {
        if (!cfg.channel_id) {
          return interaction.reply({
            embeds: [errorEmbed('Channel Missing', 'No goodbye channel has been designated. Use `/goodbye set-channel` first.')],
            ephemeral: true,
          });
        }

        const targetChan = await interaction.guild.channels.fetch(cfg.channel_id).catch(() => null);
        if (!targetChan || !targetChan.isTextBased()) {
          return interaction.reply({
            embeds: [errorEmbed('Channel Inaccessible', 'The configured goodbye channel could not be reached.')],
            ephemeral: true,
          });
        }

        await targetChan.send({ embeds: [embed] });
        return interaction.reply({
          embeds: [successEmbed('Test Dispatched', `Test departure announcement dispatched to <#${targetChan.id}>.`)],
          ephemeral: true,
        });
      }
    }
  },
};
