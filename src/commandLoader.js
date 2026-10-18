const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

function loadCommands(client) {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        try {
          const command = require(fullPath);
          if (command.data && command.execute) {
            if (client && client.commands) {
              client.commands.set(command.data.name, command);
            }
            commands.push(command);
          } else {
            logger.warn(`File at ${fullPath} is missing required "data" or "execute" export.`);
          }
        } catch (err) {
          logger.error(`Error loading command file ${fullPath}: ${err.message}`);
        }
      }
    }
  }

  scanDir(commandsPath);
  return commands;
}

module.exports = {
  loadCommands,
};
