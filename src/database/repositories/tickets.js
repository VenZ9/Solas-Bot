const { getDatabase } = require('../index');

module.exports = {
  getConfig(guildId) {
    const db = getDatabase();
    let row = db.prepare('SELECT * FROM ticket_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO ticket_config (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM ticket_config WHERE guild_id = ?').get(guildId);
    }
    return row;
  },

  updateConfig(guildId, updates) {
    const db = getDatabase();
    this.getConfig(guildId);
    const fields = [];
    const values = [];

    if (updates.categoryId !== undefined) {
      fields.push('category_id = ?');
      values.push(updates.categoryId);
    }
    if (updates.staffRoleId !== undefined) {
      fields.push('staff_role_id = ?');
      values.push(updates.staffRoleId);
    }
    if (updates.logChannelId !== undefined) {
      fields.push('log_channel_id = ?');
      values.push(updates.logChannelId);
    }
    if (updates.panelMessageId !== undefined) {
      fields.push('panel_message_id = ?');
      values.push(updates.panelMessageId);
    }

    if (fields.length === 0) return null;

    values.push(guildId);
    return db.prepare(`UPDATE ticket_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
  },

  incrementCounter(guildId) {
    const db = getDatabase();
    this.getConfig(guildId);
    db.prepare('UPDATE ticket_config SET ticket_counter = ticket_counter + 1 WHERE guild_id = ?').run(guildId);
    const row = db.prepare('SELECT ticket_counter FROM ticket_config WHERE guild_id = ?').get(guildId);
    return row.ticket_counter;
  },

  createTicket(guildId, channelId, creatorId) {
    const db = getDatabase();
    const ticketNumber = this.incrementCounter(guildId);
    const result = db.prepare(`
      INSERT INTO tickets (ticket_number, guild_id, channel_id, creator_id, status, created_at)
      VALUES (?, ?, ?, ?, 'open', ?)
    `).run(ticketNumber, guildId, channelId, creatorId, Date.now());

    return {
      id: result.lastInsertRowid,
      ticketNumber,
      guildId,
      channelId,
      creatorId,
      status: 'open',
    };
  },

  getTicketByChannel(channelId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId) || null;
  },

  getTicketById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) || null;
  },

  claimTicket(ticketId, claimedBy) {
    const db = getDatabase();
    return db.prepare(`
      UPDATE tickets
      SET claimed_by = ?
      WHERE id = ?
    `).run(claimedBy, ticketId);
  },

  closeTicket(ticketId, closedBy, closeReason = '') {
    const db = getDatabase();
    return db.prepare(`
      UPDATE tickets
      SET status = 'closed', closed_at = ?, closed_by = ?, close_reason = ?
      WHERE id = ?
    `).run(Date.now(), closedBy, closeReason, ticketId);
  },

  reopenTicket(ticketId) {
    const db = getDatabase();
    return db.prepare(`
      UPDATE tickets
      SET status = 'open', closed_at = NULL, closed_by = NULL, close_reason = NULL
      WHERE id = ?
    `).run(ticketId);
  },
};
