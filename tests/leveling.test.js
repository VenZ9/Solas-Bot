const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const levelingRepo = require('../src/database/repositories/leveling');

test('Leveling System Mechanics', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    closeDatabase();
  });

  const guildId = 'guild_lvl_01';

  await t.test('XP progression curve functions correctly', () => {
    assert.equal(levelingRepo.getXpForLevel(0), 0);
    const xpLvl1 = levelingRepo.getXpForLevel(1);
    const xpLvl2 = levelingRepo.getXpForLevel(2);

    assert.ok(xpLvl1 > 0);
    assert.ok(xpLvl2 > xpLvl1);

    assert.equal(levelingRepo.getLevelFromTotalXp(0), 0);
    assert.equal(levelingRepo.getLevelFromTotalXp(xpLvl1), 1);
    assert.equal(levelingRepo.getLevelFromTotalXp(xpLvl2), 2);
  });

  await t.test('addXp updates user profile and detects level up events', () => {
    const userId = 'user_xp_test';
    const xpNeededForLvl1 = levelingRepo.getXpForLevel(1);

    const step1 = levelingRepo.addXp(guildId, userId, xpNeededForLvl1 - 10);
    assert.equal(step1.leveledUp, false);
    assert.equal(step1.newLevel, 0);

    const step2 = levelingRepo.addXp(guildId, userId, 20);
    assert.equal(step2.leveledUp, true);
    assert.equal(step2.oldLevel, 0);
    assert.equal(step2.newLevel, 1);
  });

  await t.test('leaderboard ranks members properly by total XP', () => {
    levelingRepo.addXp(guildId, 'user_a', 500);
    levelingRepo.addXp(guildId, 'user_b', 1200);
    levelingRepo.addXp(guildId, 'user_c', 800);

    const board = levelingRepo.getLeaderboard(guildId, 10, 0);
    assert.equal(board[0].user_id, 'user_b');
    assert.equal(board[1].user_id, 'user_c');
    assert.equal(board[2].user_id, 'user_a');

    const rankB = levelingRepo.getUserRank(guildId, 'user_b');
    assert.equal(rankB.rank, 1);

    const rankA = levelingRepo.getUserRank(guildId, 'user_a');
    assert.equal(rankA.rank, 3);
  });
});
