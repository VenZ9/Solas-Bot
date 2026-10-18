const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const reminderService = require('../src/services/reminderService');
const remindersRepo = require('../src/database/repositories/reminders');
const giveawayService = require('../src/services/giveawayService');
const giveawaysRepo = require('../src/database/repositories/giveaways');
const { parseDuration } = require('../src/utils/time');

test('Timer Safety, 32-bit Overflow Guards, & Periodic Sweeper', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    reminderService.stopSweeper();
    giveawayService.stopSweeper();
    closeDatabase();
  });

  await t.test('parseDuration parses and validates durations without overflowing', () => {
    assert.equal(parseDuration('10s'), 10000);
    assert.equal(parseDuration('15m'), 15 * 60 * 1000);
    assert.equal(parseDuration('2h'), 2 * 60 * 60 * 1000);
    assert.equal(parseDuration('30d'), 30 * 24 * 60 * 60 * 1000);

    // Bounded check: extreme invalid or overflowing values return null
    assert.equal(parseDuration('999999999999999999999999d'), null);
    assert.equal(parseDuration('-5m'), null);
    assert.equal(parseDuration('invalid'), null);
  });

  await t.test('scheduleReminder does not set 32-bit overflowing setTimeout on durations > 25 days', () => {
    let warningEmitted = false;
    const warningListener = (warning) => {
      if (warning.name === 'TimeoutOverflowWarning') {
        warningEmitted = true;
      }
    };
    process.on('warning', warningListener);

    // 30 days is 2,592,000,000 ms, which exceeds 32-bit signed max (2,147,483,647 ms)
    const longDurationMs = 30 * 24 * 60 * 60 * 1000;
    const reminder = remindersRepo.createReminder(
      'user_long_time',
      'channel_1',
      'guild_1',
      '30-day reminder',
      Date.now() + longDurationMs
    );

    const dummyClient = { users: { fetch: async () => null } };
    reminderService.scheduleReminder(reminder, dummyClient);

    // Clean up warning listener
    process.removeListener('warning', warningListener);

    assert.equal(warningEmitted, false, 'Node.js TimeoutOverflowWarning should never be emitted');
    // Because duration exceeds SAFE_SCHEDULE_WINDOW, it is saved in DB but not directly assigned a JS timer
    assert.equal(reminderService.timers.has(reminder.id), false, 'Long-duration reminder is managed by sweeper');
  });

  await t.test('scheduleGiveaway does not set 32-bit overflowing setTimeout on long giveaways', () => {
    let warningEmitted = false;
    const warningListener = (warning) => {
      if (warning.name === 'TimeoutOverflowWarning') {
        warningEmitted = true;
      }
    };
    process.on('warning', warningListener);

    const longDurationMs = 30 * 24 * 60 * 60 * 1000;
    const giveaway = giveawaysRepo.createGiveaway({
      guildId: 'guild_long',
      channelId: 'chan_long',
      messageId: 'msg_long',
      prize: 'Annual Nitro',
      winnerCount: 1,
      endTime: Date.now() + longDurationMs,
      createdBy: 'host_1',
    });

    const dummyClient = { guilds: { fetch: async () => null } };
    giveawayService.scheduleGiveaway(giveaway, dummyClient);

    process.removeListener('warning', warningListener);

    assert.equal(warningEmitted, false, 'No TimeoutOverflowWarning on long giveaway');
    assert.equal(giveawayService.timers.has(giveaway.id), false, 'Long giveaway managed by sweeper');
  });

  await t.test('sweeper resolves expired deadlines immediately without duplication', async () => {
    let triggeredCount = 0;
    const mockClient = {
      users: {
        async fetch() {
          triggeredCount++;
          return { send: async () => {} };
        },
      },
    };

    // Create an expired reminder (trigger_at in the past)
    const expired = remindersRepo.createReminder(
      'user_expired',
      'channel_test',
      'guild_1',
      'Expired task',
      Date.now() - 5000
    );

    // Run sweeper
    reminderService.sweepReminders(mockClient);

    // Wait microtask
    await new Promise(r => setTimeout(r, 50));

    // Verify reminder is completed
    const updated = remindersRepo.getReminderById(expired.id);
    assert.equal(updated.completed, 1);
    assert.equal(triggeredCount, 1);

    // Second sweep must NOT trigger again
    reminderService.sweepReminders(mockClient);
    await new Promise(r => setTimeout(r, 50));
    assert.equal(triggeredCount, 1, 'Duplicate sweep should be prevented by atomic completion');
  });

  await t.test('stopSweeper clears all intervals and timer handles', () => {
    reminderService.startSweeper({});
    giveawayService.startSweeper({});

    assert.ok(reminderService.sweeperInterval !== null);
    assert.ok(giveawayService.sweeperInterval !== null);

    reminderService.stopSweeper();
    giveawayService.stopSweeper();

    assert.equal(reminderService.sweeperInterval, null);
    assert.equal(giveawayService.sweeperInterval, null);
    assert.equal(reminderService.timers.size, 0);
    assert.equal(giveawayService.timers.size, 0);
  });
});
