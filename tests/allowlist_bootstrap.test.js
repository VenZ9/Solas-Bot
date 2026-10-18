const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const allowlistRepo = require('../src/database/repositories/allowlist');
const guildCreateEvent = require('../src/events/guildCreate');
const readyEvent = require('../src/events/ready');
const interactionCreateEvent = require('../src/events/interactionCreate');
const config = require('../src/config');

test('Allowlist Initial-Setup Bootstrap & Guild Lifecycle Enforcement', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  const ownerId = 'configured_owner_999';
  config.ownerId = ownerId;
  config.devGuildId = null; // Do not auto-seed in this test

  t.after(() => {
    closeDatabase();
  });

  await t.test('guildCreate does not leave server when allowlist is empty', async () => {
    assert.equal(allowlistRepo.isAllowlistEmpty(), true);

    let left = false;
    const mockGuild = {
      id: 'initial_setup_guild_1',
      name: 'Initial Setup Server',
      leave: async () => {
        left = true;
      },
    };

    await guildCreateEvent.execute(mockGuild);
    assert.equal(left, false, 'Bot should not auto-leave server while allowlist is empty');
  });

  await t.test('interactionCreate permits owner and rejects non-owner during initial-setup state', async () => {
    assert.equal(allowlistRepo.isAllowlistEmpty(), true);

    let nonOwnerReplied = false;
    let nonOwnerReplyEmbed = null;

    const mockNonOwnerInteraction = {
      guildId: 'initial_setup_guild_1',
      user: { id: 'random_user_123' },
      isRepliable: () => true,
      isChatInputCommand: () => true,
      commandName: 'ping',
      reply: async (payload) => {
        nonOwnerReplied = true;
        nonOwnerReplyEmbed = payload.embeds[0];
      },
    };

    await interactionCreateEvent.execute(mockNonOwnerInteraction);

    assert.equal(nonOwnerReplied, true);
    assert.ok(nonOwnerReplyEmbed.data.title.includes('Setup Required'));

    // Now test owner interaction: should NOT be blocked by allowlist
    let ownerBlockedByAllowlist = false;
    const mockOwnerInteraction = {
      guildId: 'initial_setup_guild_1',
      user: { id: ownerId },
      isRepliable: () => true,
      isChatInputCommand: () => true,
      commandName: 'owner',
      client: { commands: new Map() },
      reply: async (payload) => {
        if (payload?.embeds?.[0]?.data?.title?.includes('Setup Required')) {
          ownerBlockedByAllowlist = true;
        }
      },
    };

    await interactionCreateEvent.execute(mockOwnerInteraction);
    assert.equal(ownerBlockedByAllowlist, false, 'Owner should not be blocked by empty allowlist');
  });

  await t.test('authorizing initial server transitions state and ejects unauthorized guilds', async () => {
    // Owner authorizes initial guild
    allowlistRepo.addGuild('authorized_guild_1', ownerId, 'Authorized by owner');

    assert.equal(allowlistRepo.isAllowlistEmpty(), false);
    assert.equal(allowlistRepo.isGuildAllowed('authorized_guild_1'), true);
    assert.equal(allowlistRepo.isGuildAllowed('unauthorized_guild_2'), false);

    // Now guildCreate on unauthorized server must leave
    let leftUnauthorized = false;
    const mockUnauthorizedGuild = {
      id: 'unauthorized_guild_2',
      name: 'Unauthorized Server',
      leave: async () => {
        leftUnauthorized = true;
      },
    };

    await guildCreateEvent.execute(mockUnauthorizedGuild);
    assert.equal(leftUnauthorized, true, 'Bot must leave unauthorized guild once allowlist is initialized');
  });

  await t.test('post-initialization interactionCreate rejects unauthorized guilds even for non-owners', async () => {
    let replied = false;
    let replyEmbed = null;

    const mockInteraction = {
      guildId: 'unauthorized_guild_2',
      user: { id: 'random_user_456' },
      isRepliable: () => true,
      reply: async (payload) => {
        replied = true;
        replyEmbed = payload.embeds[0];
      },
    };

    await interactionCreateEvent.execute(mockInteraction);

    assert.equal(replied, true);
    assert.ok(replyEmbed.data.title.includes('Unauthorized Server'));
  });
});
