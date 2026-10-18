const test = require('node:test');
const assert = require('node:assert/strict');
const { checkHierarchy, canManageRole } = require('../src/utils/permissions');

test('Role Hierarchy Validation', async (t) => {
  const guildOwnerId = 'owner_100';
  const botId = 'bot_200';

  const mockGuild = { ownerId: guildOwnerId, id: 'guild_001' };

  const mockBotMember = {
    id: botId,
    guild: mockGuild,
    roles: { highest: { position: 50 } },
  };

  await t.test('cannot moderate the server owner', () => {
    const executor = { id: 'admin_1', guild: mockGuild, roles: { highest: { position: 80 } } };
    const targetOwner = { id: guildOwnerId, guild: mockGuild, roles: { highest: { position: 100 } } };

    const result = checkHierarchy(executor, targetOwner, mockBotMember);
    assert.equal(result.canAct, false);
    assert.match(result.reason, /server owner cannot be targeted/i);
  });

  await t.test('cannot moderate self', () => {
    const executor = { id: 'admin_1', guild: mockGuild, roles: { highest: { position: 80 } } };
    const result = checkHierarchy(executor, executor, mockBotMember);
    assert.equal(result.canAct, false);
    assert.match(result.reason, /cannot execute this action on yourself/i);
  });

  await t.test('cannot moderate the bot itself', () => {
    const executor = { id: 'admin_1', guild: mockGuild, roles: { highest: { position: 80 } } };
    const result = checkHierarchy(executor, mockBotMember, mockBotMember);
    assert.equal(result.canAct, false);
    assert.match(result.reason, /bot cannot target itself/i);
  });

  await t.test('executor cannot moderate equal or higher role', () => {
    const executor = { id: 'mod_1', guild: mockGuild, roles: { highest: { position: 20 } } };
    const targetSame = { id: 'target_1', guild: mockGuild, roles: { highest: { position: 20 } } };
    const targetHigher = { id: 'target_2', guild: mockGuild, roles: { highest: { position: 30 } } };

    assert.equal(checkHierarchy(executor, targetSame, mockBotMember).canAct, false);
    assert.equal(checkHierarchy(executor, targetHigher, mockBotMember).canAct, false);
  });

  await t.test('bot cannot moderate equal or higher role than bot highest', () => {
    const serverOwnerExecutor = { id: guildOwnerId, guild: mockGuild, roles: { highest: { position: 100 } } };
    const targetAboveBot = { id: 'target_high', guild: mockGuild, roles: { highest: { position: 60 } } }; // bot is 50

    const result = checkHierarchy(serverOwnerExecutor, targetAboveBot, mockBotMember);
    assert.equal(result.canAct, false);
    assert.match(result.reason, /bot's highest role/i);
  });

  await t.test('valid hierarchy allows action', () => {
    const executor = { id: 'mod_1', guild: mockGuild, roles: { highest: { position: 40 } } };
    const targetLower = { id: 'user_1', guild: mockGuild, roles: { highest: { position: 10 } } };

    const result = checkHierarchy(executor, targetLower, mockBotMember);
    assert.equal(result.canAct, true);
  });

  await t.test('canManageRole rejects managed integration roles or roles above bot', () => {
    const executor = { id: 'admin_1', guild: mockGuild, roles: { highest: { position: 80 } } };
    const managedRole = { id: 'r_managed', guild: mockGuild, managed: true, position: 10 };
    const roleAboveBot = { id: 'r_high', guild: mockGuild, managed: false, position: 60 };
    const validRole = { id: 'r_valid', guild: mockGuild, managed: false, position: 20 };

    assert.equal(canManageRole(executor, mockBotMember, managedRole).canAct, false);
    assert.equal(canManageRole(executor, mockBotMember, roleAboveBot).canAct, false);
    assert.equal(canManageRole(executor, mockBotMember, validRole).canAct, true);
  });
});
