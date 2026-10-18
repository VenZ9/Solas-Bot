const { getDatabase } = require('../index');

module.exports = {
  isGuildAllowed(guildId) {
    const db = getDatabase();
    const row = db.prepare('SELECT guild_id FROM guild_allowlist WHERE guild_id = ?').get(guildId);
    return Boolean(row);
  },

  getAllowedGuilds() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM guild_allowlist ORDER BY added_at DESC').all();
  },

  addGuild(guildId, addedBy, reason = 'Authorized by owner') {
    const db = getDatabase();
    return db.prepare(`
      INSERT INTO guild_allowlist (guild_id, added_at, added_by, reason)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        added_at = excluded.added_at,
        added_by = excluded.added_by,
        reason = excluded.reason
    `).run(guildId, Date.now(), addedBy, reason);
  },

  removeGuild(guildId) {
    const db = getDatabase();
    return db.prepare('DELETE FROM guild_allowlist WHERE guild_id = ?').run(guildId);
  },
};
