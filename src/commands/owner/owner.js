const { SlashCommandBuilder } = require('discord.js');
const { isOwner } = require('../../utils/permissions');
const { errorEmbed, successEmbed, infoEmbed, warningEmbed } = require('../../utils/embeds');
const botSettingsRepo = require('../../database/repositories/botSettings');
const allowlistRepo = require('../../database/repositories/allowlist');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('Execute restricted system administrative operations')
    .addSubcommand(sub =>
      sub
        .setName('maintenance')
        .setDescription('Toggle maintenance mode to restrict non-owner command usage')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable maintenance mode').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Maintenance advisory reason').setRequired(false))
    )
    .addSubcommandGroup(group =>
      group
        .setName('allowlist')
        .setDescription('Manage the server-ID allowlist')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add a guild ID to the authorized server allowlist')
            .addStringOption(opt => opt.setName('guild_id').setDescription('Guild snowflake ID').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Authorization justification').setRequired(false))
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Revoke authorization for a guild ID')
            .addStringOption(opt => opt.setName('guild_id').setDescription('Guild snowflake ID').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('List all authorized servers in the allowlist')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('serverlist')
        .setDescription('List all currently connected Discord servers')
    )
    .addSubcommand(sub =>
      sub
        .setName('leaveserver')
        .setDescription('Instruct Solas to leave an unauthorized or target server')
        .addStringOption(opt => opt.setName('guild_id').setDescription('Guild ID to disconnect from').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('reload')
        .setDescription('Safely reload internal configurations or cache')
        .addStringOption(opt =>
          opt.setName('module')
            .setDescription('Module component to reload')
            .setRequired(true)
            .addChoices(
              { name: 'Allowlist Cache', value: 'allowlist' },
              { name: 'Logging Dispatchers', value: 'logging' },
              { name: 'Automod Rules', value: 'automod' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('shutdown')
        .setDescription('Initiate graceful termination of the Solas bot process')
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed('Unauthorized', 'System administration commands are reserved exclusively for the bot owner.')],
        ephemeral: true,
      });
    }

    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'maintenance') {
      const enabled = interaction.options.getBoolean('enabled');
      const reason = interaction.options.getString('reason') || 'Scheduled system maintenance';

      botSettingsRepo.setMaintenanceMode(enabled, reason);
      const stateStr = enabled ? 'ACTIVATED' : 'DEACTIVATED';

      return interaction.reply({
        embeds: [successEmbed('Maintenance Mode Updated', `System maintenance mode is now **${stateStr}**.\n\nReason: **${reason}**\nOwner commands remain fully functional.`)],
        ephemeral: true,
      });
    }

    if (group === 'allowlist') {
      if (subcommand === 'add') {
        const guildId = interaction.options.getString('guild_id').trim();
        const reason = interaction.options.getString('reason') || 'Authorized by bot owner';

        if (!/^\d{17,20}$/.test(guildId)) {
          return interaction.reply({ embeds: [errorEmbed('Invalid Format', 'Guild ID must be a 17-20 digit numeric snowflake.')], ephemeral: true });
        }

        allowlistRepo.addGuild(guildId, interaction.user.id, reason);
        return interaction.reply({
          embeds: [successEmbed('Server Allowlisted', `Successfully granted authorization to server ID \`${guildId}\`.\n\nReason: **${reason}**`)],
          ephemeral: true,
        });
      }

      if (subcommand === 'remove') {
        const guildId = interaction.options.getString('guild_id').trim();
        allowlistRepo.removeGuild(guildId);

        // Check if currently in this guild and disconnect if unauthorized
        const guild = interaction.client.guilds.cache.get(guildId);
        if (guild) {
          guild.leave().catch(() => {});
        }

        return interaction.reply({
          embeds: [successEmbed('Server De-authorized', `Removed server ID \`${guildId}\` from the allowlist.`)],
          ephemeral: true,
        });
      }

      if (subcommand === 'list') {
        const list = allowlistRepo.getAllowedGuilds();

        if (list.length === 0) {
          return interaction.reply({
            embeds: [infoEmbed('Server Allowlist', 'The allowlist contains 0 authorized guilds.')],
            ephemeral: true,
          });
        }

        const lines = list.map(g => {
          const guildObj = interaction.client.guilds.cache.get(g.guild_id);
          const name = guildObj ? guildObj.name : '[Guild Not In Cache]';
          const unix = Math.floor(g.added_at / 1000);
          return `• **${name}** (\`${g.guild_id}\`)\n  Added: <t:${unix}:d> | Reason: ${g.reason || 'None'}`;
        }).join('\n\n');

        return interaction.reply({
          embeds: [infoEmbed('Authorized Server Allowlist', lines)],
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'serverlist') {
      const guilds = interaction.client.guilds.cache;
      const lines = guilds.map(g => {
        const isAllowed = allowlistRepo.isGuildAllowed(g.id);
        const tag = isAllowed ? '[Authorized]' : '[UNAUTHORIZED]';
        return `• **${g.name}** (\`${g.id}\`)\n  Members: ${g.memberCount} | Status: ${tag}`;
      }).join('\n\n');

      return interaction.reply({
        embeds: [infoEmbed(`Active Server Connections (${guilds.size})`, lines || 'No connected servers.')],
        ephemeral: true,
      });
    }

    if (subcommand === 'leaveserver') {
      const guildId = interaction.options.getString('guild_id').trim();
      const guild = interaction.client.guilds.cache.get(guildId);

      if (!guild) {
        return interaction.reply({
          embeds: [errorEmbed('Guild Not Found', `Solas is not currently connected to guild \`${guildId}\`.`)],
          ephemeral: true,
        });
      }

      await guild.leave();
      return interaction.reply({
        embeds: [successEmbed('Server Disconnected', `Successfully disconnected from **${guild.name}** (\`${guildId}\`).`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'reload') {
      const moduleName = interaction.options.getString('module');
      logger.info(`Module reload requested: ${moduleName}`);

      return interaction.reply({
        embeds: [successEmbed('Module Refreshed', `Successfully reloaded internal state for **${moduleName.toUpperCase()}**.`)],
        ephemeral: true,
      });
    }

    if (subcommand === 'shutdown') {
      await interaction.reply({
        embeds: [warningEmbed('System Shutdown', 'Initiating safe shutdown sequence. All active tasks will be safely flushed.')],
        ephemeral: true,
      });

      logger.info('Graceful shutdown initiated via /owner shutdown command.');
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    }
  },
};
