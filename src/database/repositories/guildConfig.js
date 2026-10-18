const { getDatabase } = require('../index');

module.exports = {
  getConfig(guildId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId) || null;
  },

  setModLogChannel(guildId, channelId) {
    const db = getDatabase();
    return db.prepare(`
      INSERT INTO guild_config (guild_id, mod_log_channel, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        mod_log_channel = excluded.mod_log_channel,
        updated_at = excluded.updated_at
    `).run(guildId, channelId, Date.now());
  },
};
