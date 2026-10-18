const logger = require('./logger');

let registeredClient = null;
let isShuttingDown = false;

function registerClient(client) {
  registeredClient = client;
}

function getClient() {
  return registeredClient;
}

async function gracefulShutdown(signal = 'MANUAL', exitFn = process.exit) {
  if (isShuttingDown) {
    logger.warn('Graceful shutdown is already in progress.');
    return;
  }
  isShuttingDown = true;
  logger.info(`Executing graceful shutdown sequence (${signal})...`);

  try {
    // 1. Stop background timer sweepers
    try {
      const giveawayService = require('../services/giveawayService');
      const reminderService = require('../services/reminderService');
      if (giveawayService && typeof giveawayService.stopSweeper === 'function') {
        giveawayService.stopSweeper();
      }
      if (reminderService && typeof reminderService.stopSweeper === 'function') {
        reminderService.stopSweeper();
      }
      logger.info('Background schedulers and sweeper intervals terminated.');
    } catch (err) {
      logger.warn(`Could not terminate sweepers: ${err.message}`);
    }

    // 2. Disconnect Discord Client Gateway
    if (registeredClient && typeof registeredClient.destroy === 'function') {
      try {
        registeredClient.destroy();
        logger.info('Discord client gateway session terminated.');
      } catch (err) {
        logger.warn(`Error closing Discord client: ${err.message}`);
      }
    }

    // 3. Close SQLite Database Connection
    try {
      const { closeDatabase } = require('../database');
      closeDatabase();
      logger.info('SQLite database connection cleanly closed.');
    } catch (err) {
      logger.warn(`Error closing database: ${err.message}`);
    }

    logger.info('Graceful shutdown complete. Exiting process.');
    if (typeof exitFn === 'function') {
      exitFn(0);
    }
  } catch (err) {
    logger.error(`Fatal error during graceful shutdown: ${err.message}`);
    if (typeof exitFn === 'function') {
      exitFn(1);
    }
  } finally {
    isShuttingDown = false;
  }
}

module.exports = {
  registerClient,
  getClient,
  gracefulShutdown,
};
