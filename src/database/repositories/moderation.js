const { getDatabase } = require('../index');

module.exports = {
  addWarning(guildId, userId, moderatorId, reason) {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO moderation_warnings (guild_id, user_id, moderator_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(guildId, userId, moderatorId, reason, Date.now());

    this.logAction(guildId, userId, moderatorId, 'WARN', reason, null);
    return result.lastInsertRowid;
  },

  getWarnings(guildId, userId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM moderation_warnings
      WHERE guild_id = ? AND user_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(guildId, userId);
  },

  getWarningById(guildId, warningId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM moderation_warnings
      WHERE guild_id = ? AND id = ?
    `).get(guildId, warningId);
  },

  removeWarning(guildId, warningId) {
    const db = getDatabase();
    return db.prepare(`
      DELETE FROM moderation_warnings
      WHERE guild_id = ? AND id = ?
    `).run(guildId, warningId);
  },

  clearWarnings(guildId, userId) {
    const db = getDatabase();
    return db.prepare(`
      DELETE FROM moderation_warnings
      WHERE guild_id = ? AND user_id = ?
    `).run(guildId, userId);
  },

  logAction(guildId, userId, moderatorId, actionType, reason = '', duration = null) {
    const db = getDatabase();
    return db.prepare(`
      INSERT INTO moderation_actions (guild_id, user_id, moderator_id, action_type, reason, duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, userId, moderatorId, actionType, reason, duration, Date.now());
  },

  getRecentActions(guildId, limit = 20) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM moderation_actions
      WHERE guild_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(guildId, limit);
  },
};
