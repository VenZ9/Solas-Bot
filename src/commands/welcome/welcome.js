const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const https = require('https');
const http = require('http');
const config = require('../../config');
const { errorEmbed, successEmbed, infoEmbed, GlassEmbed } = require('../../utils/embeds');
const welcomeRepo = require('../../database/repositories/welcome');
const { validateImageUpload, getSafeImagePath } = require('../../utils/sanitize');
const loggingService = require('../../services/loggingService');
const { TAGS, COLORS } = require('../../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure server join welcome messages, templates, and background banners')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable member welcome announcements')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable welcome messages').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('set-channel')
        .setDescription('Designate the channel where welcome messages are sent')
        .addChannelOption(opt => opt.setName('channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('message')
        .setDescription('Set template message (Placeholders: {user}, {server}, {member_count})')
        .addStringOption(opt => opt.setName('template').setDescription('Message template content').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('image-upload')
        .setDescription('Upload a custom welcome banner image (PNG/JPEG/WEBP/GIF, max 2MB)')
        .addAttachmentOption(opt => opt.setName('image').setDescription('Banner image file').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('preview')
        .setDescription('Preview how the welcome announcement embed will render')
    )
    .addSubcommand(sub =>
      sub
        .setName('test')
        .setDescription('Send a test welcome message to the configured channel')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled');
      welcomeRepo.updateWelcomeConfig(guildId, { enabled });
      loggingService.logConfigChange(interaction.guild, interaction.user, 'welcome_enabled', 'updated', enabled ? 'ON' : 'OFF');

      return interaction.reply({
        embeds: [successEmbed('Welcome Messages Updated', `Welcome announcements are now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'set-channel') {
      const channel = interaction.options.getChannel('channel');
      welcomeRepo.updateWelcomeConfig(guildId, { channelId: channel.id });
      loggingService.logConfigChange(interaction.guild, interaction.user, 'welcome_channel', 'updated', channel.name);

      return interaction.reply({
        embeds: [successEmbed('Welcome Channel Assigned', `Welcome announcements will be posted in <#${channel.id}>.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'message') {
      const template = interaction.options.getString('template');
      welcomeRepo.updateWelcomeConfig(guildId, { message: template });
      loggingService.logConfigChange(interaction.guild, interaction.user, 'welcome_message', 'updated', template);

      return interaction.reply({
        embeds: [successEmbed('Welcome Template Stored', `Template set to:\n\n> ${template}\n\nAvailable placeholders: \`{user}\`, \`{server}\`, \`{member_count}\``)],
        ephemeral: true,
      });
    }

    if (subcommand === 'image-upload') {
      const attachment = interaction.options.getAttachment('image');
      const validation = validateImageUpload(attachment);

      if (!validation.valid) {
        return interaction.reply({
          embeds: [errorEmbed('Upload Rejected', validation.error)],
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const { filename, absolutePath } = getSafeImagePath(config.welcomeAssetsDir, guildId, validation.ext);

        // Safely stream download to destination
        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(absolutePath);
          const getter = attachment.url.startsWith('https') ? https : http;

          getter.get(attachment.url, response => {
            if (response.statusCode !== 200) {
              return reject(new Error(`Failed to download image (HTTP ${response.statusCode})`));
            }
            response.pipe(file);
            file.on('finish', () => {
              file.close(resolve);
            });
          }).on('error', err => {
            fs.unlink(absolutePath, () => {});
            reject(err);
          });
        });

        welcomeRepo.updateWelcomeConfig(guildId, { imagePath: absolutePath });
        loggingService.logConfigChange(interaction.guild, interaction.user, 'welcome_banner', 'updated', filename);

        return interaction.editReply({
          embeds: [successEmbed('Banner Saved', `Successfully persisted welcome banner image.\n\nFile: \`${filename}\``)],
        });
      } catch (err) {
        return interaction.editReply({
          embeds: [errorEmbed('Persistence Error', `Failed to store banner: ${err.message}`)],
        });
      }
    }

    if (subcommand === 'preview' || subcommand === 'test') {
      const cfg = welcomeRepo.getWelcomeConfig(guildId);
      const renderedText = welcomeRepo.renderTemplate(cfg.message, interaction.member);

      const embed = new GlassEmbed()
        .setColor(COLORS.PRIMARY)
        .setGlassTitle(TAGS.SYSTEM, 'Welcome to the Server')
        .setGlassDescription(renderedText);

      embed.addGlassField('Member Count', String(interaction.guild.memberCount), true);

      const files = [];
      if (cfg.image_path && fs.existsSync(cfg.image_path)) {
        files.push(cfg.image_path);
        embed.setImage(`attachment://${require('path').basename(cfg.image_path)}`);
      }

      if (subcommand === 'preview') {
        return interaction.reply({
          content: 'Here is a preview of the rendered welcome embed:',
          embeds: [embed],
          files,
          ephemeral: true,
        });
      } else {
        if (!cfg.channel_id) {
          return interaction.reply({
            embeds: [errorEmbed('Channel Missing', 'No welcome channel has been designated. Use `/welcome set-channel` first.')],
            ephemeral: true,
          });
        }

        const targetChan = await interaction.guild.channels.fetch(cfg.channel_id).catch(() => null);
        if (!targetChan || !targetChan.isTextBased()) {
          return interaction.reply({
            embeds: [errorEmbed('Channel Inaccessible', 'The configured welcome channel could not be reached.')],
            ephemeral: true,
          });
        }

        await targetChan.send({ content: `<@${interaction.user.id}>`, embeds: [embed], files });
        return interaction.reply({
          embeds: [successEmbed('Test Dispatched', `Test welcome announcement dispatched to <#${targetChan.id}>.`)],
          ephemeral: true,
        });
      }
    }
  },
};
