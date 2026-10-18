const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const remindersRepo = require('../src/database/repositories/reminders');

test('Reminders Persistence & Restart Recovery', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    closeDatabase();
  });

  const userId = 'remind_user_1';
  const channelId = 'remind_chan_1';

  let reminder = null;

  await t.test('creates reminder and retrieves from pending queue', () => {
    const triggerAt = Date.now() + 10000;
    reminder = remindersRepo.createReminder(userId, channelId, 'guild_1', 'Submit monthly report', triggerAt);

    assert.ok(reminder);
    assert.equal(reminder.completed, 0);
    assert.equal(reminder.message, 'Submit monthly report');

    const pending = remindersRepo.getPendingReminders();
    assert.ok(pending.some(r => r.id === reminder.id));
  });

  await t.test('atomicCompleteReminder prevents duplicate notification dispatch', () => {
    const firstCall = remindersRepo.atomicCompleteReminder(reminder.id);
    assert.equal(firstCall, true, 'First completion attempt must succeed');

    const secondCall = remindersRepo.atomicCompleteReminder(reminder.id);
    assert.equal(secondCall, false, 'Second completion attempt must return false (duplicate suppression)');

    const pendingAfter = remindersRepo.getPendingReminders();
    assert.equal(pendingAfter.some(r => r.id === reminder.id), false);
  });

  await t.test('cancelReminder marks reminder as completed so it will not trigger', () => {
    const r2 = remindersRepo.createReminder(userId, channelId, 'guild_1', 'Doctor appointment', Date.now() + 20000);
    const cancelled = remindersRepo.cancelReminder(r2.id, userId);

    assert.equal(cancelled, true);

    const pending = remindersRepo.getPendingReminders();
    assert.equal(pending.some(r => r.id === r2.id), false);
  });
});
