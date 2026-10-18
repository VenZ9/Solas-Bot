const remindersRepo = require('../database/repositories/reminders');
const logger = require('../utils/logger');
const { infoEmbed } = require('../utils/embeds');

class ReminderService {
  constructor() {
    this.timers = new Map();
  }

  scheduleReminder(reminder, client) {
    if (!reminder || reminder.completed) return;

    if (this.timers.has(reminder.id)) {
      clearTimeout(this.timers.get(reminder.id));
    }

    const remainingMs = reminder.trigger_at - Date.now();

    if (remainingMs <= 0) {
      this.triggerReminder(reminder.id, client);
    } else {
      const timer = setTimeout(() => {
        this.triggerReminder(reminder.id, client);
      }, remainingMs);
      this.timers.set(reminder.id, timer);
    }
  }

  async triggerReminder(reminderId, client) {
    this.timers.delete(reminderId);

    // Atomic completion check to prevent duplicate alerts
    const updated = remindersRepo.atomicCompleteReminder(reminderId);
    if (!updated) {
      return; // Already completed or cancelled
    }

    const reminder = remindersRepo.getReminderById(reminderId);
    if (!reminder) return;

    try {
      const user = await client.users.fetch(reminder.user_id).catch(() => null);
      if (!user) return;

      const embed = infoEmbed(
        'Scheduled Reminder',
        `Notification for <@${reminder.user_id}>:\n\n${reminder.message}`
      );

      // Try sending to original channel, fall back to DM
      let sent = false;
      if (reminder.channel_id) {
        const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
        if (channel && channel.isTextBased()) {
          await channel.send({ content: `<@${reminder.user_id}>`, embeds: [embed] }).catch(() => {});
          sent = true;
        }
      }

      if (!sent) {
        await user.send({ embeds: [embed] }).catch(err => {
          logger.warn(`Could not send reminder DM to ${reminder.user_id}: ${err.message}`);
        });
      }
    } catch (err) {
      logger.error(`Error triggering reminder ${reminderId}: ${err.message}`);
    }
  }

  recoverPendingReminders(client) {
    const pending = remindersRepo.getPendingReminders();
    logger.info(`Recovering ${pending.length} pending reminder(s) after startup.`);

    for (const reminder of pending) {
      this.scheduleReminder(reminder, client);
    }
  }

  cancelReminder(reminderId, userId) {
    if (this.timers.has(reminderId)) {
      clearTimeout(this.timers.get(reminderId));
      this.timers.delete(reminderId);
    }
    return remindersRepo.cancelReminder(reminderId, userId);
  }
}

module.exports = new ReminderService();
