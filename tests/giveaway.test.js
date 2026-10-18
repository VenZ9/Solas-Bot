const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const giveawaysRepo = require('../src/database/repositories/giveaways');
const giveawayService = require('../src/services/giveawayService');

test('Giveaways Engine & Recovery Idempotency', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    closeDatabase();
  });

  const guildId = 'guild_giveaway_test';
  const channelId = 'channel_gw_1';
  const messageId = 'msg_gw_1';

  let createdGiveaway = null;

  await t.test('creates giveaway and persists configuration', () => {
    createdGiveaway = giveawaysRepo.createGiveaway({
      guildId,
      channelId,
      messageId,
      prize: 'Discord Nitro Premium',
      winnerCount: 2,
      endTime: Date.now() + 60000,
      createdBy: 'host_user_1',
    });

    assert.ok(createdGiveaway);
    assert.equal(createdGiveaway.ended, 0);
    assert.equal(createdGiveaway.prize, 'Discord Nitro Premium');
  });

  await t.test('toggleEntry allows entering and leaving', () => {
    const res1 = giveawaysRepo.toggleEntry(createdGiveaway.id, 'participant_1');
    assert.equal(res1.entered, true);
    assert.equal(res1.entryCount, 1);

    const res2 = giveawaysRepo.toggleEntry(createdGiveaway.id, 'participant_2');
    assert.equal(res2.entered, true);
    assert.equal(res2.entryCount, 2);

    // Leave
    const res3 = giveawaysRepo.toggleEntry(createdGiveaway.id, 'participant_1');
    assert.equal(res3.entered, false);
    assert.equal(res3.entryCount, 1);

    // Re-enter
    giveawaysRepo.toggleEntry(createdGiveaway.id, 'participant_1');
    giveawaysRepo.toggleEntry(createdGiveaway.id, 'participant_3');
    assert.equal(giveawaysRepo.getEntryCount(createdGiveaway.id), 3);
  });

  await t.test('atomicEndGiveaway guarantees no duplicate winners or duplicate announcements', () => {
    const firstResolution = giveawaysRepo.atomicEndGiveaway(createdGiveaway.id);
    assert.ok(firstResolution, 'First call must succeed in ending giveaway');
    assert.equal(firstResolution.ended, 1);
    assert.equal(firstResolution.winners.length, 2);

    // Subsequent or concurrent resolution call
    const secondResolution = giveawaysRepo.atomicEndGiveaway(createdGiveaway.id);
    assert.equal(secondResolution, null, 'Second call must return null (idempotency guard)');
  });

  await t.test('reroll selects winner from remaining entries pool', () => {
    const newWinners = giveawaysRepo.rerollGiveaway(createdGiveaway.id, 1);
    assert.ok(newWinners.length > 0);
    assert.ok(newWinners.every(id => ['participant_1', 'participant_2', 'participant_3'].includes(id)));
  });

  await t.test('active giveaways recovery accurately filters unended giveaways', () => {
    // Create an unended giveaway
    const activeGw = giveawaysRepo.createGiveaway({
      guildId,
      channelId: 'chan_2',
      messageId: 'msg_2',
      prize: 'Steam Game Key',
      winnerCount: 1,
      endTime: Date.now() + 50000,
      createdBy: 'host_user_1',
    });

    const activeList = giveawaysRepo.getActiveGiveaways(guildId);
    assert.equal(activeList.length, 1);
    assert.equal(activeList[0].id, activeGw.id);

    // Cancel giveaway
    giveawaysRepo.cancelGiveaway(activeGw.id);
    assert.equal(giveawaysRepo.getActiveGiveaways(guildId).length, 0);
  });
});
