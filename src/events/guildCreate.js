const allowlistRepo = require('../database/repositories/allowlist');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    if (allowlistRepo.isAllowlistEmpty()) {
      logger.warn(`Initial Setup State: Solas joined guild "${guild.name}" (${guild.id}) while allowlist is empty. Awaiting owner authorization.`);
      return;
    }

    const isAllowed = allowlistRepo.isGuildAllowed(guild.id);

    if (!isAllowed) {
      logger.warn(`Security Enforcement: Solas joined unauthorized guild "${guild.name}" (${guild.id}). Leaving immediately.`);
      try {
        await guild.leave();
      } catch (err) {
        logger.error(`Failed to automatically leave unauthorized guild ${guild.id}: ${err.message}`);
      }
    } else {
      logger.info(`Connected to authorized guild "${guild.name}" (${guild.id}).`);
    }
  },
};
