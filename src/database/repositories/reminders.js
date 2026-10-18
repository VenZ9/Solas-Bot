const { getDatabase } = require('../index');

module.exports = {
  createReminder(userId, channelId, guildId, message, triggerAt) {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO reminders (user_id, channel_id, guild_id, message, trigger_at, completed, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(userId, channelId, guildId, message, triggerAt, Date.now());

    return this.getReminderById(result.lastInsertRowid);
  },

  getReminderById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) || null;
  },

  getPendingReminders() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM reminders WHERE completed = 0 ORDER BY trigger_at ASC').all();
  },

  getUserReminders(userId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM reminders WHERE user_id = ? AND completed = 0 ORDER BY trigger_at ASC').all(userId);
  },

  /**
   * Atomically completes the reminder.
   * Returns true if successfully marked from 0 to 1, or false if already completed.
   */
  atomicCompleteReminder(id) {
    const db = getDatabase();
    const result = db.prepare('UPDATE reminders SET completed = 1 WHERE id = ? AND completed = 0').run(id);
    return result.changes > 0;
  },

  cancelReminder(id, userId) {
    const db = getDatabase();
    const result = db.prepare('UPDATE reminders SET completed = 1 WHERE id = ? AND user_id = ? AND completed = 0').run(id, userId);
    return result.changes > 0;
  },
};
