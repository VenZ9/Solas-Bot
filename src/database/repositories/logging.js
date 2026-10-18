const { getDatabase } = require('../index');

module.exports = {
  getConfig(guildId) {
    const db = getDatabase();
    let row = db.prepare('SELECT * FROM logging_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO logging_config (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM logging_config WHERE guild_id = ?').get(guildId);
    }
    return row;
  },

  setChannel(guildId, channelId) {
    const db = getDatabase();
    this.getConfig(guildId);
    return db.prepare('UPDATE logging_config SET channel_id = ? WHERE guild_id = ?').run(channelId, guildId);
  },

  setToggle(guildId, eventName, enabled) {
    const db = getDatabase();
    this.getConfig(guildId);

    const validEvents = {
      edits: 'log_edits',
      deletes: 'log_deletes',
      joins: 'log_joins',
      leaves: 'log_leaves',
      roles: 'log_roles',
      channels: 'log_channels',
      mod: 'log_mod',
      mod_actions: 'log_mod',
      tickets: 'log_tickets',
      config: 'log_config',
    };

    const column = validEvents[eventName];
    if (!column) return null;

    return db.prepare(`UPDATE logging_config SET ${column} = ? WHERE guild_id = ?`)
      .run(enabled ? 1 : 0, guildId);
  },
};
