const config = require('./src/config');
const logger = require('./src/utils/logger');
const { initDatabase, closeDatabase } = require('./src/database');
const { createClient } = require('./src/client');
const { loadCommands } = require('./src/commandLoader');
const { loadEvents } = require('./src/eventLoader');

async function main() {
  logger.info('Starting Solas Operations Core...');

  // Validate configuration
  try {
    config.validate();
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  // Initialize SQLite persistence & migrations (does not wipe existing data)
  initDatabase(config.databasePath);

  // Initialize Discord client
  const client = createClient();

  // Load commands and events
  const commands = loadCommands(client);
  logger.info(`Loaded ${commands.length} top-level slash command definitions.`);

  loadEvents(client);
  logger.info('Registered event listeners.');

  // Graceful shutdown handling
  let isShuttingDown = false;
  async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Executing graceful shutdown sequence...`);

    try {
      if (client && client.isReady()) {
        client.destroy();
        logger.info('Discord client connection closed.');
      }
      closeDatabase();
      logger.info('Shutdown complete.');
      process.exit(0);
    } catch (err) {
      logger.error(`Error during shutdown: ${err.message}`);
      process.exit(1);
    }
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception caught:', err);
  });

  // Connect to Discord Gateway
  try {
    await client.login(config.token);
  } catch (err) {
    logger.error(`Discord login authentication failure: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
