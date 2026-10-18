const allowlistRepo = require('../database/repositories/allowlist');
const automodService = require('../services/automodService');
const levelingService = require('../services/levelingService');
const logger = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    // Verify guild allowlist
    if (!allowlistRepo.isGuildAllowed(message.guild.id)) {
      return;
    }

    try {
      // 1. Automod checks (mass-mentions and rapid spam)
      await automodService.handleMessage(message);

      // 2. Leveling XP accumulation & cooldown tracking
      await levelingService.handleMessage(message);
    } catch (err) {
      logger.error(`Error in messageCreate pipeline: ${err.message}`);
    }
  },
};
