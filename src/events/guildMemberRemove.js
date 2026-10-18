const allowlistRepo = require('../database/repositories/allowlist');
const welcomeRepo = require('../database/repositories/welcome');
const loggingService = require('../services/loggingService');
const { GlassEmbed } = require('../utils/embeds');
const { COLORS, TAGS } = require('../constants');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    if (!allowlistRepo.isGuildAllowed(member.guild.id)) return;

    // 1. Audit Logging
    loggingService.logMemberLeave(member);

    // 2. Goodbye Announcement
    try {
      const cfg = welcomeRepo.getGoodbyeConfig(member.guild.id);
      if (cfg.enabled && cfg.channel_id) {
        const channel = await member.guild.channels.fetch(cfg.channel_id).catch(() => null);
        if (channel && channel.isTextBased()) {
          const rendered = welcomeRepo.renderTemplate(cfg.message, member);

          const embed = new GlassEmbed()
            .setColor(COLORS.WARNING)
            .setGlassTitle(TAGS.SYSTEM, 'Member Departure')
            .setGlassDescription(rendered);

          embed.addGlassField('Remaining Members', String(member.guild.memberCount), true);

          await channel.send({ embeds: [embed] });
        }
      }
    } catch (err) {
      logger.error(`Error processing goodbye event in guild ${member.guild.id}: ${err.message}`);
    }
  },
};
