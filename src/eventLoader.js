const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

function loadEvents(client) {
  const eventsPath = path.join(__dirname, 'events');
  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);
      if (event.name && event.execute) {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }
      }
    } catch (err) {
      logger.error(`Error registering event listener ${file}: ${err.message}`);
    }
  }
}

module.exports = {
  loadEvents,
};
