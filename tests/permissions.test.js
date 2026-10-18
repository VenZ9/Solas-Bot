const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config');
const { isOwner, hasPermission } = require('../src/utils/permissions');

test('Permissions and Authorization Validation', async (t) => {
  const originalOwnerId = config.ownerId;
  config.ownerId = 'owner_99999';

  t.after(() => {
    config.ownerId = originalOwnerId;
  });

  await t.test('isOwner returns true only for matching ownerId', () => {
    assert.equal(isOwner('owner_99999'), true);
    assert.equal(isOwner('random_user_123'), false);
    assert.equal(isOwner(''), false);
    assert.equal(isOwner(null), false);
  });

  await t.test('hasPermission grants access to server owner', () => {
    const mockMember = {
      id: 'guild_owner_1',
      guild: { ownerId: 'guild_owner_1' },
      permissions: { has: () => false },
    };
    assert.equal(hasPermission(mockMember, 'BanMembers'), true);
  });

  await t.test('hasPermission grants access to Administrator', () => {
    const mockMember = {
      id: 'admin_user_2',
      guild: { ownerId: 'other_owner' },
      permissions: {
        has: (perm) => perm === 'Administrator',
      },
    };
    assert.equal(hasPermission(mockMember, 'BanMembers'), true);
  });

  await t.test('hasPermission checks explicit permission bitfield for normal members', () => {
    const authorizedMember = {
      id: 'mod_1',
      guild: { ownerId: 'other_owner' },
      permissions: {
        has: (perm) => perm === 'KickMembers',
      },
    };

    const unauthorizedMember = {
      id: 'regular_1',
      guild: { ownerId: 'other_owner' },
      permissions: {
        has: () => false,
      },
    };

    assert.equal(hasPermission(authorizedMember, 'KickMembers'), true);
    assert.equal(hasPermission(unauthorizedMember, 'KickMembers'), false);
  });
});
