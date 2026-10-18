const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const automodRepo = require('../src/database/repositories/automod');
const automodService = require('../src/services/automodService');

test('Automod Mechanics & Memory Bound Guards', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    closeDatabase();
  });

  const guildId = 'guild_automod_test';

  await t.test('updates and queries automod configuration', () => {
    automodRepo.updateMentions(guildId, true, 4, 'timeout', 300);
    automodRepo.updateSpam(guildId, true, 5, 3, 'timeout', 300);

    const cfg = automodRepo.getConfig(guildId);
    assert.equal(cfg.mentions_enabled, 1);
    assert.equal(cfg.mention_threshold, 4);
    assert.equal(cfg.spam_enabled, 1);
    assert.equal(cfg.spam_messages, 5);
    assert.equal(cfg.spam_seconds, 3);
  });

  await t.test('exempts administrators and exempt roles', () => {
    const cfg = automodRepo.getConfig(guildId);
    automodRepo.addExemptRole(guildId, 'trusted_role_1');
    const updatedCfg = automodRepo.getConfig(guildId);

    const adminMember = {
      user: { bot: false },
      permissions: { has: (perm) => perm === 'Administrator' },
      guild: { ownerId: 'other_owner' },
      roles: { cache: new Map() },
    };

    const trustedMember = {
      user: { bot: false },
      permissions: { has: () => false },
      guild: { ownerId: 'other_owner' },
      roles: { cache: new Map([['trusted_role_1', { id: 'trusted_role_1' }]]) },
    };

    const regularMember = {
      user: { bot: false },
      permissions: { has: () => false },
      guild: { ownerId: 'other_owner' },
      roles: { cache: new Map() },
    };

    const channel = { id: 'chan_general' };

    assert.equal(automodService.isExempt(adminMember, channel, updatedCfg), true);
    assert.equal(automodService.isExempt(trustedMember, channel, updatedCfg), true);
    assert.equal(automodService.isExempt(regularMember, channel, updatedCfg), false);
  });

  await t.test('cleans stale entries and caps memory bounds', () => {
    // Fill message history with dummy entries
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      automodService.messageHistory.set(`user_${i}_${guildId}`, {
        timestamps: [now - 60000], // Old timestamps
      });
    }

    automodService.lastCleanup = 0; // Force cleanup
    automodService.cleanStaleEntries();

    assert.equal(automodService.messageHistory.size, 0, 'Stale sliding window records must be pruned');
  });
});
