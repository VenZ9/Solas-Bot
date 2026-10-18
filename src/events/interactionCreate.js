const { isOwner } = require('../utils/permissions');
const { errorEmbed, warningEmbed } = require('../utils/embeds');
const allowlistRepo = require('../database/repositories/allowlist');
const botSettingsRepo = require('../database/repositories/botSettings');
const { handleButtonInteraction } = require('../handlers/buttonHandler');
const { handleModalSubmit } = require('../handlers/modalHandler');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // 1. Guild Allowlist Enforcement
      if (interaction.guildId) {
        if (allowlistRepo.isAllowlistEmpty()) {
          // While allowlist is empty, permit ONLY the configured bot owner to interact (e.g. to run /owner allowlist add)
          if (!isOwner(interaction.user.id)) {
            logger.warn(`Initial Setup State: Non-owner interaction rejected from user ${interaction.user.id} in guild ${interaction.guildId}`);
            if (interaction.isRepliable()) {
              return interaction.reply({
                embeds: [errorEmbed('Setup Required', 'Solas is in an initial uninitialized setup state. Only the configured bot owner can authorize this server using `/owner allowlist add`.')],
                ephemeral: true,
              }).catch(() => {});
            }
            return;
          }
        } else {
          const allowed = allowlistRepo.isGuildAllowed(interaction.guildId);
          if (!allowed) {
            logger.warn(`Unauthorized interaction attempt from unapproved guild ${interaction.guildId}`);
            if (interaction.isRepliable()) {
              return interaction.reply({
                embeds: [errorEmbed('Unauthorized Server', 'This Discord server is not authorized to utilize the Solas Operations Core.')],
                ephemeral: true,
              }).catch(() => {});
            }
            return;
          }
        }
      }

      // 2. Maintenance Mode Guard
      const isMaint = botSettingsRepo.isMaintenanceMode();
      if (isMaint && !isOwner(interaction.user.id)) {
        const reason = botSettingsRepo.getSetting('maintenance_reason', 'Scheduled maintenance in progress.');
        if (interaction.isRepliable()) {
          return interaction.reply({
            embeds: [warningEmbed('System Maintenance', `Solas is currently under maintenance and restricted to system administrators.\n\nAdvisory: ${reason}`)],
            ephemeral: true,
          }).catch(() => {});
        }
        return;
      }

      // 3. Slash Command Dispatcher
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
          logger.warn(`Slash command not registered: ${interaction.commandName}`);
          return interaction.reply({
            embeds: [errorEmbed('Command Not Found', 'This command is not recognized by the system dispatch handler.')],
            ephemeral: true,
          });
        }

        await command.execute(interaction);
        return;
      }

      // 4. Button Dispatcher
      if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
        return;
      }

      // 5. Modal Submit Dispatcher
      if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
        return;
      }
    } catch (err) {
      logger.error(`Error processing interaction (${interaction.type}): ${err.message}`, err);

      const errResponse = {
        embeds: [errorEmbed('Execution Error', 'An unexpected error occurred while processing this interaction.')],
        ephemeral: true,
      };

      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errResponse).catch(() => {});
        } else {
          await interaction.reply(errResponse).catch(() => {});
        }
      }
    }
  },
};
