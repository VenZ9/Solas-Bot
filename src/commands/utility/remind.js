const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed, infoEmbed } = require('../../utils/embeds');
const remindersRepo = require('../../database/repositories/reminders');
const reminderService = require('../../services/reminderService');
const { parseDuration, formatDuration } = require('../../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Schedule time-based notifications that survive server and bot restarts')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Create a persistent reminder')
        .addStringOption(opt => opt.setName('in').setDescription('Duration until trigger (e.g. 10m, 2h, 1d)').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Reminder message text').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all your pending scheduled reminders')
    )
    .addSubcommand(sub =>
      sub
        .setName('cancel')
        .setDescription('Cancel an active reminder by ID')
        .addIntegerOption(opt => opt.setName('id').setDescription('Reminder ID to cancel').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'set') {
      const durationInput = interaction.options.getString('in');
      const message = interaction.options.getString('message');

      const durationMs = parseDuration(durationInput);
      if (!durationMs || durationMs < 5000) {
        return interaction.reply({
          embeds: [errorEmbed('Invalid Duration', 'Duration must be at least 5 seconds (e.g. `10s`, `15m`, `3h`, `2d`).')],
          ephemeral: true,
        });
      }

      const triggerAt = Date.now() + durationMs;
      const reminder = remindersRepo.createReminder(
        userId,
        interaction.channel ? interaction.channel.id : null,
        interaction.guild ? interaction.guild.id : null,
        message,
        triggerAt
      );

      reminderService.scheduleReminder(reminder, interaction.client);

      const triggerUnix = Math.floor(triggerAt / 1000);
      return interaction.reply({
        embeds: [successEmbed('Reminder Scheduled', `Reminder **#${reminder.id}** set for <t:${triggerUnix}:R> (<t:${triggerUnix}:f>).\n\nMessage: **${message}**`)],
      });
    }

    if (subcommand === 'list') {
      const list = remindersRepo.getUserReminders(userId);

      if (list.length === 0) {
        return interaction.reply({
          embeds: [infoEmbed('Pending Reminders', 'You have no pending reminders scheduled.')],
          ephemeral: true,
        });
      }

      const lines = list.map(r => {
        const unix = Math.floor(r.trigger_at / 1000);
        return `• **[#${r.id}]** <t:${unix}:R> (<t:${unix}:f>)\n  "${r.message}"`;
      }).join('\n\n');

      return interaction.reply({
        embeds: [infoEmbed('Your Scheduled Reminders', lines)],
        ephemeral: true,
      });
    }

    if (subcommand === 'cancel') {
      const reminderId = interaction.options.getInteger('id');
      const success = reminderService.cancelReminder(reminderId, userId);

      if (!success) {
        return interaction.reply({
          embeds: [errorEmbed('Cancellation Failed', `No active reminder with ID **#${reminderId}** belongs to you.`)],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [successEmbed('Reminder Cancelled', `Successfully cancelled reminder **#${reminderId}**.`)],
        ephemeral: true,
      });
    }
  },
};
