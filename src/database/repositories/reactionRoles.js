const { getDatabase } = require('../index');

module.exports = {
  createPanel(panelId, guildId, channelId, title, description = '', multiSelect = true) {
    const db = getDatabase();
    return db.prepare(`
      INSERT INTO reaction_role_panels (id, guild_id, channel_id, title, description, multi_select)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(panelId, guildId, channelId, title, description, multiSelect ? 1 : 0);
  },

  getPanel(panelId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM reaction_role_panels WHERE id = ?').get(panelId) || null;
  },

  getPanelsForGuild(guildId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ?').all(guildId);
  },

  deletePanel(panelId) {
    const db = getDatabase();
    return db.prepare('DELETE FROM reaction_role_panels WHERE id = ?').run(panelId);
  },

  addItem(panelId, roleId, label, style = 'Secondary') {
    const db = getDatabase();
    return db.prepare(`
      INSERT INTO reaction_role_items (panel_id, role_id, label, style)
      VALUES (?, ?, ?, ?)
    `).run(panelId, roleId, label, style);
  },

  removeItem(panelId, roleId) {
    const db = getDatabase();
    return db.prepare(`
      DELETE FROM reaction_role_items
      WHERE panel_id = ? AND role_id = ?
    `).run(panelId, roleId);
  },

  getItems(panelId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM reaction_role_items WHERE panel_id = ?').all(panelId);
  },
};
