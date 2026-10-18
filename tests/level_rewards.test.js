const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const levelingRepo = require('../src/database/repositories/leveling');
const levelingService = require('../src/services/levelingService');

test('Level Milestone Rewards & Idempotency', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    closeDatabase();
  });

  const guildId = 'guild_rewards_test';

  await t.test('stores and queries level rewards correctly', () => {
    levelingRepo.addReward(guildId, 5, 'role_lvl_5');
    levelingRepo.addReward(guildId, 10, 'role_lvl_10');
    levelingRepo.addReward(guildId, 20, 'role_lvl_20');

    const rewardsAtLevel8 = levelingRepo.getEligibleRewards(guildId, 8);
    assert.equal(rewardsAtLevel8.length, 1);
    assert.equal(rewardsAtLevel8[0].role_id, 'role_lvl_5');

    const rewardsAtLevel15 = levelingRepo.getEligibleRewards(guildId, 15);
    assert.equal(rewardsAtLevel15.length, 2);
  });

  await t.test('idempotent reward role assignment does not duplicate existing roles', async () => {
    let addRoleCallCount = 0;

    const mockMember = {
      id: 'member_reward_01',
      roles: {
        cache: new Map([['role_lvl_5', { id: 'role_lvl_5' }]]), // Already has role_lvl_5
        add: async (roleId) => {
          addRoleCallCount++;
        },
      },
    };

    const mockGuild = {
      id: guildId,
      roles: {
        cache: new Map([
          ['role_lvl_5', { id: 'role_lvl_5', position: 10, managed: false }],
          ['role_lvl_10', { id: 'role_lvl_10', position: 15, managed: false }],
        ]),
      },
      members: {
        me: {
          permissions: { has: (perm) => perm === 'ManageRoles' },
          roles: { highest: { position: 50 } },
        },
      },
    };

    const mockMessage = {
      guild: mockGuild,
      member: mockMember,
      channel: { send: async () => {} },
      author: { id: 'member_reward_01' },
    };

    // Trigger level 10 rewards (should only add role_lvl_10 since role_lvl_5 is already in cache)
    await levelingService.handleLevelUp(mockMessage, 10);

    assert.equal(addRoleCallCount, 1, 'Should only call add role for the unassigned role (idempotent)');
  });

  await t.test('gracefully handles missing bot permissions without throwing', async () => {
    const mockMember = {
      id: 'member_reward_02',
      roles: {
        cache: new Map(),
        add: async () => {
          throw new Error('DiscordAPIError: Missing Permissions');
        },
      },
    };

    const mockGuild = {
      id: guildId,
      roles: {
        cache: new Map([['role_lvl_5', { id: 'role_lvl_5', position: 80, managed: false }]]), // above bot
      },
      members: {
        me: {
          permissions: { has: () => false }, // Bot lacks ManageRoles
          roles: { highest: { position: 10 } },
        },
      },
    };

    const mockMessage = {
      guild: mockGuild,
      member: mockMember,
      channel: { send: async () => {} },
      author: { id: 'member_reward_02' },
    };

    // Should complete cleanly without uncaught exception
    await assert.doesNotReject(async () => {
      await levelingService.handleLevelUp(mockMessage, 5);
    });
  });
});
