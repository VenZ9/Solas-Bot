const allowlistRepo = require('../database/repositories/allowlist');
const loggingService = require('../services/loggingService');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild) return;
    if (!allowlistRepo.isGuildAllowed(newMessage.guild.id)) return;

    loggingService.logMessageUpdate(oldMessage, newMessage);
  },
};
