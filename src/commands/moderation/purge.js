const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const moderationRepo = require('../../database/repositories/moderation');
const loggingService = require('../../services/loggingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages from the current channel with optional filters')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to inspect (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(opt => opt.setName('user').setDescription('Purge only messages from this specific user').setRequired(false))
    .addStringOption(opt =>
      opt.setName('filter')
        .setDescription('Optional message content filter')
        .setRequired(false)
        .addChoices(
          { name: 'Bots Only', value: 'bots' },
          { name: 'Contains Attachments', value: 'attachments' },
          { name: 'Contains Embeds', value: 'embeds' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');
    const filter = interaction.options.getString('filter');

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);

      const filtered = messages.filter(msg => {
        // Discord cannot bulkDelete messages older than 14 days
        if (msg.createdTimestamp < fourteenDaysAgo) return false;

        if (targetUser && msg.author.id !== targetUser.id) return false;
        if (filter === 'bots' && !msg.author.bot) return false;
        if (filter === 'attachments' && msg.attachments.size === 0) return false;
        if (filter === 'embeds' && msg.embeds.length === 0) return false;

        return true;
      });

      if (filtered.size === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Matching Messages', 'No messages matching the specified criteria within the 14-day limit could be purged.')],
        });
      }

      const deleted = await interaction.channel.bulkDelete(filtered, true);

      moderationRepo.logAction(interaction.guild.id, targetUser ? targetUser.id : 'MULTIPLE', interaction.user.id, 'PURGE', `Purged ${deleted.size} messages`);
      loggingService.logModAction(interaction.guild, 'PURGE', interaction.user, { id: 'CHANNEL', tag: interaction.channel.name }, `Purged ${deleted.size} messages in <#${interaction.channel.id}>`);

      return interaction.editReply({
        embeds: [successEmbed('Messages Purged', `Successfully cleared **${deleted.size}** message(s) from <#${interaction.channel.id}>.`)],
      });
    } catch (err) {
      return interaction.editReply({
        embeds: [errorEmbed('Purge Failed', `Encountered an error while deleting messages: ${err.message}`)],
      });
    }
  },
};
