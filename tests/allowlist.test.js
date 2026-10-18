const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const allowlistRepo = require('../src/database/repositories/allowlist');

test('Server-ID Allowlist Repository & Bootstrap State', async (t) => {
  // Use in-memory SQLite for test isolation
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    closeDatabase();
  });

  await t.test('fresh database starts in uninitialized empty allowlist state', () => {
    assert.equal(allowlistRepo.getAllowlistCount(), 0);
    assert.equal(allowlistRepo.isAllowlistEmpty(), true);
    assert.equal(allowlistRepo.isGuildAllowed('999999999999999999'), false);
  });

  await t.test('adding initial guild transitions allowlist from empty to initialized', () => {
    const guildId = '111122223333444455';
    allowlistRepo.addGuild(guildId, 'owner_123', 'Initial bootstrap authorization');

    assert.equal(allowlistRepo.isAllowlistEmpty(), false);
    assert.equal(allowlistRepo.getAllowlistCount(), 1);
    assert.equal(allowlistRepo.isGuildAllowed(guildId), true);

    const list = allowlistRepo.getAllowedGuilds();
    const entry = list.find(g => g.guild_id === guildId);
    assert.ok(entry);
    assert.equal(entry.added_by, 'owner_123');
    assert.equal(entry.reason, 'Initial bootstrap authorization');
  });

  await t.test('removing guild revokes authorization and updates count', () => {
    const guildId = '111122223333444455';
    allowlistRepo.removeGuild(guildId);

    assert.equal(allowlistRepo.isGuildAllowed(guildId), false);
    assert.equal(allowlistRepo.getAllowlistCount(), 0);
    assert.equal(allowlistRepo.isAllowlistEmpty(), true);
  });
});
