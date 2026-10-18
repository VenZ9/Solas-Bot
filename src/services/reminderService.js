const remindersRepo = require('../database/repositories/reminders');
const logger = require('../utils/logger');
const { infoEmbed } = require('../utils/embeds');

const SAFE_SCHEDULE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours (safely below 32-bit limit)
const SWEEPER_INTERVAL_MS = 30 * 1000; // 30 seconds

class ReminderService {
  constructor() {
    this.timers = new Map();
    this.sweeperInterval = null;
    this.client = null;
  }

  startSweeper(client) {
    this.client = client;
    if (this.sweeperInterval) {
      clearInterval(this.sweeperInterval);
    }

    this.sweepReminders(client);
    this.sweeperInterval = setInterval(() => {
      this.sweepReminders(this.client);
    }, SWEEPER_INTERVAL_MS);

    if (typeof this.sweeperInterval.unref === 'function') {
      this.sweeperInterval.unref();
    }
  }

  stopSweeper() {
    if (this.sweeperInterval) {
      clearInterval(this.sweeperInterval);
      this.sweeperInterval = null;
    }

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  sweepReminders(client) {
    if (!client) return;
    try {
      const pending = remindersRepo.getPendingReminders();
      const now = Date.now();

      for (const reminder of pending) {
        const remainingMs = reminder.trigger_at - now;
        if (remainingMs <= 0) {
          this.triggerReminder(reminder.id, client);
        } else if (remainingMs <= SAFE_SCHEDULE_WINDOW && !this.timers.has(reminder.id)) {
          const timer = setTimeout(() => {
            this.triggerReminder(reminder.id, client);
          }, remainingMs);
          this.timers.set(reminder.id, timer);
        }
      }
    } catch (err) {
      logger.error(`Error in reminder sweeper: ${err.message}`);
    }
  }

  scheduleReminder(reminder, client) {
    if (!reminder || reminder.completed) return;

    if (this.timers.has(reminder.id)) {
      clearTimeout(this.timers.get(reminder.id));
      this.timers.delete(reminder.id);
    }

    const remainingMs = reminder.trigger_at - Date.now();

    if (remainingMs <= 0) {
      this.triggerReminder(reminder.id, client);
    } else if (remainingMs <= SAFE_SCHEDULE_WINDOW) {
      const timer = setTimeout(() => {
        this.triggerReminder(reminder.id, client);
      }, remainingMs);
      this.timers.set(reminder.id, timer);
    } else {
      logger.debug(`Reminder #${reminder.id} deadline is ${remainingMs}ms in future; registered for background sweeper.`);
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
    if (client) {
      this.startSweeper(client);
    }
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
