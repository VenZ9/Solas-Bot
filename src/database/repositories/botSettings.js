const { getDatabase } = require('../index');

module.exports = {
  getSetting(key, defaultValue = null) {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  },

  setSetting(key, value) {
    const db = getDatabase();
    return db.prepare(`
      INSERT INTO bot_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
  },

  isMaintenanceMode() {
    return this.getSetting('maintenance_mode', '0') === '1';
  },

  setMaintenanceMode(enabled, reason = '') {
    this.setSetting('maintenance_mode', enabled ? '1' : '0');
    if (reason) {
      this.setSetting('maintenance_reason', reason);
    }
  },
};
