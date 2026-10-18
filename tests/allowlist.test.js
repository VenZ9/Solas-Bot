const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const allowlistRepo = require('../src/database/repositories/allowlist');

test('Server-ID Allowlist Repository', async (t) => {
  // Use in-memory SQLite for test isolation
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    closeDatabase();
  });

  await t.test('unregistered guild returns false for isGuildAllowed', () => {
    assert.equal(allowlistRepo.isGuildAllowed('999999999999999999'), false);
  });

  await t.test('adding guild allows it and records metadata', () => {
    const guildId = '111122223333444455';
    allowlistRepo.addGuild(guildId, 'owner_123', 'Approved test server');

    assert.equal(allowlistRepo.isGuildAllowed(guildId), true);

    const list = allowlistRepo.getAllowedGuilds();
    const entry = list.find(g => g.guild_id === guildId);
    assert.ok(entry);
    assert.equal(entry.added_by, 'owner_123');
    assert.equal(entry.reason, 'Approved test server');
  });

  await t.test('removing guild revokes authorization', () => {
    const guildId = '111122223333444455';
    allowlistRepo.removeGuild(guildId);

    assert.equal(allowlistRepo.isGuildAllowed(guildId), false);
  });
});
