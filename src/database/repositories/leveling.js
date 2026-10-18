const { getDatabase } = require('../index');

/**
 * Total XP required to reach a specific level
 */
function getXpForLevel(level) {
  if (level <= 0) return 0;
  // Cumulative standard curve: 5 * L^2 + 50 * L + 100 per level
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += 5 * Math.pow(i, 2) + 50 * i + 100;
  }
  return total;
}

/**
 * Calculates current level from total accumulated XP
 */
function getLevelFromTotalXp(totalXp) {
  if (!totalXp || totalXp <= 0) return 0;
  let level = 0;
  while (getXpForLevel(level + 1) <= totalXp) {
    level++;
  }
  return level;
}

module.exports = {
  getXpForLevel,
  getLevelFromTotalXp,

  getConfig(guildId) {
    const db = getDatabase();
    let row = db.prepare('SELECT * FROM leveling_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO leveling_config (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM leveling_config WHERE guild_id = ?').get(guildId);
    }
    let exemptChannels = [];
    try {
      exemptChannels = JSON.parse(row.exempt_channels || '[]');
    } catch {
      exemptChannels = [];
    }
    return { ...row, exempt_channels: exemptChannels };
  },

  updateConfig(guildId, updates) {
    const db = getDatabase();
    this.getConfig(guildId);
    const fields = [];
    const values = [];

    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.xpRate !== undefined) {
      fields.push('xp_rate = ?');
      values.push(updates.xpRate);
    }
    if (updates.cooldownSeconds !== undefined) {
      fields.push('cooldown_seconds = ?');
      values.push(updates.cooldownSeconds);
    }
    if (updates.exemptChannels !== undefined) {
      fields.push('exempt_channels = ?');
      values.push(JSON.stringify(updates.exemptChannels));
    }

    if (fields.length === 0) return null;

    values.push(guildId);
    return db.prepare(`UPDATE leveling_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
  },

  getUserLevel(guildId, userId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM user_levels
      WHERE guild_id = ? AND user_id = ?
    `).get(guildId, userId) || { guild_id: guildId, user_id: userId, xp: 0, level: 0, last_xp_at: 0 };
  },

  addXp(guildId, userId, amount) {
    const db = getDatabase();
    const current = this.getUserLevel(guildId, userId);
    const newXp = current.xp + amount;
    const oldLevel = current.level;
    const newLevel = getLevelFromTotalXp(newXp);

    db.prepare(`
      INSERT INTO user_levels (guild_id, user_id, xp, level, last_xp_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        xp = excluded.xp,
        level = excluded.level,
        last_xp_at = excluded.last_xp_at
    `).run(guildId, userId, newXp, newLevel, Date.now());

    return {
      leveledUp: newLevel > oldLevel,
      oldLevel,
      newLevel,
      currentXp: newXp,
    };
  },

  getLeaderboard(guildId, limit = 10, offset = 0) {
    const db = getDatabase();
    return db.prepare(`
      SELECT user_id, xp, level
      FROM user_levels
      WHERE guild_id = ?
      ORDER BY xp DESC
      LIMIT ? OFFSET ?
    `).all(guildId, limit, offset);
  },

  getUserRank(guildId, userId) {
    const db = getDatabase();
    const user = this.getUserLevel(guildId, userId);
    if (user.xp === 0) {
      const count = db.prepare('SELECT COUNT(*) as count FROM user_levels WHERE guild_id = ?').get(guildId).count;
      return { rank: count || 1, xp: 0, level: 0 };
    }

    const row = db.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM user_levels
      WHERE guild_id = ? AND xp > ?
    `).get(guildId, user.xp);

    return {
      rank: row ? row.rank : 1,
      xp: user.xp,
      level: user.level,
    };
  },

  addReward(guildId, level, roleId) {
    const db = getDatabase();
    return db.prepare(`
      INSERT INTO level_rewards (guild_id, level, role_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, level) DO UPDATE SET role_id = excluded.role_id
    `).run(guildId, level, roleId);
  },

  removeReward(guildId, level) {
    const db = getDatabase();
    return db.prepare(`
      DELETE FROM level_rewards
      WHERE guild_id = ? AND level = ?
    `).run(guildId, level);
  },

  getRewards(guildId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM level_rewards
      WHERE guild_id = ?
      ORDER BY level ASC
    `).all(guildId);
  },

  getEligibleRewards(guildId, level) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM level_rewards
      WHERE guild_id = ? AND level <= ?
      ORDER BY level ASC
    `).all(guildId, level);
  },
};
