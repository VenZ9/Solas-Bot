const { getDatabase } = require('../index');

function parseWinners(str) {
  try {
    return JSON.parse(str || '[]');
  } catch {
    return [];
  }
}

module.exports = {
  createGiveaway({ guildId, channelId, messageId, prize, winnerCount, endTime, createdBy }) {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winner_count, end_time, ended, winners, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, '[]', ?, ?)
    `).run(guildId, channelId, messageId, prize, winnerCount, endTime, createdBy, Date.now());

    return this.getGiveawayById(result.lastInsertRowid);
  },

  getGiveawayById(id) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, winners: parseWinners(row.winners) };
  },

  getGiveawayByMessageId(messageId) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
    if (!row) return null;
    return { ...row, winners: parseWinners(row.winners) };
  },

  getActiveGiveaways(guildId = null) {
    const db = getDatabase();
    if (guildId) {
      const rows = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 ORDER BY end_time ASC').all(guildId);
      return rows.map(r => ({ ...r, winners: parseWinners(r.winners) }));
    }
    const rows = db.prepare('SELECT * FROM giveaways WHERE ended = 0 ORDER BY end_time ASC').all();
    return rows.map(r => ({ ...r, winners: parseWinners(r.winners) }));
  },

  toggleEntry(giveawayId, userId) {
    const db = getDatabase();
    const existing = db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').get(giveawayId, userId);

    if (existing) {
      db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(giveawayId, userId);
      const count = this.getEntryCount(giveawayId);
      return { entered: false, entryCount: count };
    } else {
      db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id, entered_at) VALUES (?, ?, ?)').run(giveawayId, userId, Date.now());
      const count = this.getEntryCount(giveawayId);
      return { entered: true, entryCount: count };
    }
  },

  getEntryCount(giveawayId) {
    const db = getDatabase();
    return db.prepare('SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = ?').get(giveawayId).count;
  },

  getEntries(giveawayId) {
    const db = getDatabase();
    return db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(giveawayId).map(r => r.user_id);
  },

  /**
   * Atomically ends the giveaway and selects winners.
   * If ended was already 1, returns null (prevents duplicate winner selection and announcements).
   */
  atomicEndGiveaway(giveawayId) {
    const db = getDatabase();
    const giveaway = this.getGiveawayById(giveawayId);
    if (!giveaway || giveaway.ended) return null;

    // Pick random unique winners from entries
    const entries = this.getEntries(giveawayId);
    const shuffled = [...entries].sort(() => 0.5 - Math.random());
    const selectedWinners = shuffled.slice(0, giveaway.winner_count);

    // Atomic update
    const result = db.prepare(`
      UPDATE giveaways
      SET ended = 1, winners = ?
      WHERE id = ? AND ended = 0
    `).run(JSON.stringify(selectedWinners), giveawayId);

    if (result.changes === 0) {
      return null; // Concurrency guard: already ended elsewhere
    }

    return {
      ...giveaway,
      ended: 1,
      winners: selectedWinners,
    };
  },

  rerollGiveaway(giveawayId, count = 1) {
    const db = getDatabase();
    const giveaway = this.getGiveawayById(giveawayId);
    if (!giveaway) return null;

    const entries = this.getEntries(giveawayId);
    if (entries.length === 0) return [];

    // Filter out previous winners if possible
    const prevWinners = new Set(giveaway.winners);
    let pool = entries.filter(id => !prevWinners.has(id));
    if (pool.length === 0) pool = entries;

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const newWinners = shuffled.slice(0, count);

    const updatedWinners = Array.from(new Set([...giveaway.winners, ...newWinners]));
    db.prepare('UPDATE giveaways SET winners = ? WHERE id = ?').run(JSON.stringify(updatedWinners), giveawayId);

    return newWinners;
  },

  cancelGiveaway(giveawayId) {
    const db = getDatabase();
    return db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(giveawayId);
  },
};
