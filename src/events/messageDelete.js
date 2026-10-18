const allowlistRepo = require('../database/repositories/allowlist');
const loggingService = require('../services/loggingService');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild) return;
    if (!allowlistRepo.isGuildAllowed(message.guild.id)) return;

    loggingService.logMessageDelete(message);
  },
};
