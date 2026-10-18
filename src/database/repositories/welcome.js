const { getDatabase } = require('../index');

function renderTemplate(template, member) {
  if (!template) return '';
  const userMention = `<@${member.id}>`;
  const serverName = member.guild?.name || 'Server';
  const memberCount = member.guild?.memberCount || 0;

  return template
    .replaceAll('{user}', userMention)
    .replaceAll('{server}', serverName)
    .replaceAll('{member_count}', String(memberCount));
}

module.exports = {
  renderTemplate,

  getWelcomeConfig(guildId) {
    const db = getDatabase();
    let row = db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO welcome_config (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId);
    }
    return row;
  },

  updateWelcomeConfig(guildId, updates) {
    const db = getDatabase();
    this.getWelcomeConfig(guildId);
    const fields = [];
    const values = [];

    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.channelId !== undefined) {
      fields.push('channel_id = ?');
      values.push(updates.channelId);
    }
    if (updates.message !== undefined) {
      fields.push('message = ?');
      values.push(updates.message);
    }
    if (updates.imagePath !== undefined) {
      fields.push('image_path = ?');
      values.push(updates.imagePath);
    }

    if (fields.length === 0) return null;

    values.push(guildId);
    return db.prepare(`UPDATE welcome_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
  },

  getGoodbyeConfig(guildId) {
    const db = getDatabase();
    let row = db.prepare('SELECT * FROM goodbye_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO goodbye_config (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM goodbye_config WHERE guild_id = ?').get(guildId);
    }
    return row;
  },

  updateGoodbyeConfig(guildId, updates) {
    const db = getDatabase();
    this.getGoodbyeConfig(guildId);
    const fields = [];
    const values = [];

    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.channelId !== undefined) {
      fields.push('channel_id = ?');
      values.push(updates.channelId);
    }
    if (updates.message !== undefined) {
      fields.push('message = ?');
      values.push(updates.message);
    }

    if (fields.length === 0) return null;

    values.push(guildId);
    return db.prepare(`UPDATE goodbye_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
  },
};
