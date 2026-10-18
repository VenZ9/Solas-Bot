const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config');
const { handleButtonInteraction } = require('../src/handlers/buttonHandler');
const { initDatabase, closeDatabase } = require('../src/database');

test('Panel Server-Side Authorization & Anti-Spoofing', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  const originalOwnerId = config.ownerId;
  config.ownerId = 'real_owner_id';

  t.after(() => {
    config.ownerId = originalOwnerId;
    closeDatabase();
  });

  await t.test('owner button rejects non-owner user even if possessing customId', async () => {
    let replyPayload = null;

    const fakeInteraction = {
      customId: 'owner_maintenance_toggle',
      user: { id: 'imposter_user_99' },
      reply: async (payload) => {
        replyPayload = payload;
      },
    };

    await handleButtonInteraction(fakeInteraction);

    assert.ok(replyPayload);
    assert.equal(replyPayload.ephemeral, true);
    assert.match(replyPayload.embeds[0].data.title, /Access Denied/i);
  });

  await t.test('moderation confirmation rejects unauthorized user who did not initiate prompt', async () => {
    let replyPayload = null;

    const fakeInteraction = {
      customId: 'mod_confirm:ban:target_123:legit_mod_456',
      user: { id: 'unauthorized_clicker_789' }, // Not legit_mod_456
      reply: async (payload) => {
        replyPayload = payload;
      },
    };

    await handleButtonInteraction(fakeInteraction);

    assert.ok(replyPayload);
    assert.equal(replyPayload.ephemeral, true);
    assert.match(replyPayload.embeds[0].data.title, /Authorization Failure/i);
  });

  await t.test('moderation confirmation rechecks permissions if initiator permissions were revoked', async () => {
    let replyPayload = null;

    const fakeInteraction = {
      customId: 'mod_confirm:ban:target_123:legit_mod_456',
      user: { id: 'legit_mod_456' },
      member: {
        permissions: {
          has: () => false, // Permission revoked since prompt was created
        },
        guild: { ownerId: 'server_owner_999' },
      },
      reply: async (payload) => {
        replyPayload = payload;
      },
    };

    await handleButtonInteraction(fakeInteraction);

    assert.ok(replyPayload);
    assert.equal(replyPayload.ephemeral, true);
    assert.match(replyPayload.embeds[0].data.title, /Permission Revoked/i);
  });
});
