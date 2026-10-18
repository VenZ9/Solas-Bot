const fs = require('fs');
const path = require('path');
const allowlistRepo = require('../database/repositories/allowlist');
const welcomeRepo = require('../database/repositories/welcome');
const loggingService = require('../services/loggingService');
const { GlassEmbed } = require('../utils/embeds');
const { COLORS, TAGS } = require('../constants');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    if (!allowlistRepo.isGuildAllowed(member.guild.id)) return;

    // 1. Audit Logging
    loggingService.logMemberJoin(member);

    // 2. Welcome Announcement
    try {
      const cfg = welcomeRepo.getWelcomeConfig(member.guild.id);
      if (cfg.enabled && cfg.channel_id) {
        const channel = await member.guild.channels.fetch(cfg.channel_id).catch(() => null);
        if (channel && channel.isTextBased()) {
          const rendered = welcomeRepo.renderTemplate(cfg.message, member);

          const embed = new GlassEmbed()
            .setColor(COLORS.PRIMARY)
            .setGlassTitle(TAGS.SYSTEM, 'Welcome to the Server')
            .setGlassDescription(rendered);

          embed.addGlassField('Member Count', String(member.guild.memberCount), true);

          const files = [];
          if (cfg.image_path && fs.existsSync(cfg.image_path)) {
            files.push(cfg.image_path);
            embed.setImage(`attachment://${path.basename(cfg.image_path)}`);
          }

          await channel.send({ content: `<@${member.id}>`, embeds: [embed], files });
        }
      }
    } catch (err) {
      logger.error(`Error processing welcome event in guild ${member.guild.id}: ${err.message}`);
    }
  },
};
