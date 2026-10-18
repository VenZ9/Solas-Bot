const { REST, Routes } = require('discord.js');
const config = require('../src/config');
const logger = require('../src/utils/logger');
const { loadCommands } = require('../src/commandLoader');

async function deployGlobal() {
  if (!config.token || !config.clientId) {
    logger.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment.');
    process.exit(1);
  }

  const commands = loadCommands().map(cmd => cmd.data.toJSON());
  logger.info(`Deploying ${commands.length} slash commands globally across Discord...`);

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    const data = await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );
    logger.info(`Successfully deployed ${data.length} global slash commands. (Note: Global commands may take up to 1 hour to propagate to all Discord regions).`);
  } catch (err) {
    logger.error(`Failed to register global slash commands: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  deployGlobal();
}

module.exports = { deployGlobal };
