const { ActivityType } = require('discord.js');
const config = require('../config');
const allowlistRepo = require('../database/repositories/allowlist');
const giveawayService = require('../services/giveawayService');
const reminderService = require('../services/reminderService');
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`Solas Operations Core authenticated as ${client.user.tag} (ID: ${client.user.id}).`);

    // 1. Auto-seed Dev Guild if provided and not yet in allowlist
    if (config.devGuildId) {
      if (!allowlistRepo.isGuildAllowed(config.devGuildId)) {
        allowlistRepo.addGuild(config.devGuildId, config.ownerId || 'SYSTEM', 'Development Guild Bootstrap');
        logger.info(`Auto-seeded dev guild ${config.devGuildId} into allowlist.`);
      }
    }

    // 2. Audit all connected guilds against allowlist
    for (const [guildId, guild] of client.guilds.cache) {
      if (!allowlistRepo.isGuildAllowed(guildId)) {
        logger.warn(`Startup Audit: Leaving unauthorized guild "${guild.name}" (${guildId}).`);
        await guild.leave().catch(err => {
          logger.error(`Could not leave unauthorized guild ${guildId}: ${err.message}`);
        });
      }
    }

    // 3. Deadline-based recovery for Giveaways and Reminders
    try {
      giveawayService.recoverActiveGiveaways(client);
      reminderService.recoverPendingReminders(client);
    } catch (err) {
      logger.error(`Error recovering background timers: ${err.message}`);
    }

    // 4. Set status & activity
    client.user.setPresence({
      activities: [{ name: 'server operations | /help', type: ActivityType.Watching }],
      status: 'online',
    });

    logger.info(`Solas is fully initialized across ${client.guilds.cache.size} authorized server(s).`);
  },
};
