const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const moderationRepo = require('../src/database/repositories/moderation');

test('Moderation Warnings & Audit Persistence', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    closeDatabase();
  });

  const guildId = 'guild_warn_test';
  const userId = 'user_warn_target';
  const modId = 'mod_author';

  await t.test('issues and records warning to database', () => {
    const id1 = moderationRepo.addWarning(guildId, userId, modId, 'First warning reason');
    const id2 = moderationRepo.addWarning(guildId, userId, modId, 'Second warning reason');

    assert.ok(id1 > 0);
    assert.ok(id2 > id1);

    const warnings = moderationRepo.getWarnings(guildId, userId);
    assert.equal(warnings.length, 2);
    assert.equal(warnings[0].reason, 'Second warning reason'); // DESC order
  });

  await t.test('removes individual warning by ID', () => {
    const warnings = moderationRepo.getWarnings(guildId, userId);
    const targetWarnId = warnings[0].id;

    const res = moderationRepo.removeWarning(guildId, targetWarnId);
    assert.equal(res.changes, 1);

    const remaining = moderationRepo.getWarnings(guildId, userId);
    assert.equal(remaining.length, 1);
    assert.notEqual(remaining[0].id, targetWarnId);
  });

  await t.test('clears all warnings for user', () => {
    moderationRepo.addWarning(guildId, userId, modId, 'Another warning');
    assert.equal(moderationRepo.getWarnings(guildId, userId).length, 2);

    const res = moderationRepo.clearWarnings(guildId, userId);
    assert.equal(res.changes, 2);

    assert.equal(moderationRepo.getWarnings(guildId, userId).length, 0);
  });

  await t.test('logs moderation actions and retrieves recent events', () => {
    moderationRepo.logAction(guildId, userId, modId, 'TIMEOUT', 'Spamming channels', 300);
    moderationRepo.logAction(guildId, userId, modId, 'BAN', 'Severe breach', null);

    const recent = moderationRepo.getRecentActions(guildId, 10);
    assert.ok(recent.length >= 2);
    assert.equal(recent[0].action_type, 'BAN');
    assert.equal(recent[1].action_type, 'TIMEOUT');
    assert.equal(recent[1].duration, 300);
  });
});
