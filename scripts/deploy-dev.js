const { REST, Routes } = require('discord.js');
const config = require('../src/config');
const logger = require('../src/utils/logger');
const { loadCommands } = require('../src/commandLoader');

async function deployDev() {
  if (!config.token || !config.clientId || !config.devGuildId) {
    logger.error('Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_DEV_GUILD_ID in environment.');
    process.exit(1);
  }

  const commands = loadCommands().map(cmd => cmd.data.toJSON());
  logger.info(`Deploying ${commands.length} slash commands to development guild (${config.devGuildId})...`);

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    const data = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.devGuildId),
      { body: commands }
    );
    logger.info(`Successfully deployed ${data.length} commands to development guild.`);
  } catch (err) {
    logger.error(`Failed to register development slash commands: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  deployDev();
}

module.exports = { deployDev };
