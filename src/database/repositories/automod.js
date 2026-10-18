const { getDatabase } = require('../index');

function parseJsonArray(str) {
  try {
    return JSON.parse(str || '[]');
  } catch {
    return [];
  }
}

module.exports = {
  getConfig(guildId) {
    const db = getDatabase();
    let row = db.prepare('SELECT * FROM automod_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare(`
        INSERT INTO automod_config (guild_id) VALUES (?)
      `).run(guildId);
      row = db.prepare('SELECT * FROM automod_config WHERE guild_id = ?').get(guildId);
    }

    return {
      ...row,
      exempt_roles: parseJsonArray(row.exempt_roles),
      exempt_channels: parseJsonArray(row.exempt_channels),
    };
  },

  updateMentions(guildId, enabled, threshold, action, duration) {
    const db = getDatabase();
    this.getConfig(guildId); // ensure row
    return db.prepare(`
      UPDATE automod_config
      SET mentions_enabled = ?, mention_threshold = ?, mention_action = ?, mention_duration = ?
      WHERE guild_id = ?
    `).run(enabled ? 1 : 0, threshold, action, duration, guildId);
  },

  updateSpam(guildId, enabled, messages, seconds, action, duration) {
    const db = getDatabase();
    this.getConfig(guildId); // ensure row
    return db.prepare(`
      UPDATE automod_config
      SET spam_enabled = ?, spam_messages = ?, spam_seconds = ?, spam_action = ?, spam_duration = ?
      WHERE guild_id = ?
    `).run(enabled ? 1 : 0, messages, seconds, action, duration, guildId);
  },

  addExemptRole(guildId, roleId) {
    const config = this.getConfig(guildId);
    const roles = new Set(config.exempt_roles);
    roles.add(roleId);
    const db = getDatabase();
    return db.prepare('UPDATE automod_config SET exempt_roles = ? WHERE guild_id = ?')
      .run(JSON.stringify(Array.from(roles)), guildId);
  },

  removeExemptRole(guildId, roleId) {
    const config = this.getConfig(guildId);
    const roles = config.exempt_roles.filter(id => id !== roleId);
    const db = getDatabase();
    return db.prepare('UPDATE automod_config SET exempt_roles = ? WHERE guild_id = ?')
      .run(JSON.stringify(roles), guildId);
  },

  addExemptChannel(guildId, channelId) {
    const config = this.getConfig(guildId);
    const channels = new Set(config.exempt_channels);
    channels.add(channelId);
    const db = getDatabase();
    return db.prepare('UPDATE automod_config SET exempt_channels = ? WHERE guild_id = ?')
      .run(JSON.stringify(Array.from(channels)), guildId);
  },

  removeExemptChannel(guildId, channelId) {
    const config = this.getConfig(guildId);
    const channels = config.exempt_channels.filter(id => id !== channelId);
    const db = getDatabase();
    return db.prepare('UPDATE automod_config SET exempt_channels = ? WHERE guild_id = ?')
      .run(JSON.stringify(channels), guildId);
  },

  disableFeature(guildId, feature) {
    const db = getDatabase();
    this.getConfig(guildId);
    if (feature === 'mentions') {
      return db.prepare('UPDATE automod_config SET mentions_enabled = 0 WHERE guild_id = ?').run(guildId);
    } else if (feature === 'spam') {
      return db.prepare('UPDATE automod_config SET spam_enabled = 0 WHERE guild_id = ?').run(guildId);
    } else if (feature === 'all') {
      return db.prepare('UPDATE automod_config SET mentions_enabled = 0, spam_enabled = 0 WHERE guild_id = ?').run(guildId);
    }
  },
};
