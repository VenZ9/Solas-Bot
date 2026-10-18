const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../src/database');
const ticketsRepo = require('../src/database/repositories/tickets');

test('Ticket Lifecycle & State Management', async (t) => {
  closeDatabase();
  initDatabase(':memory:');

  t.after(() => {
    closeDatabase();
  });

  const guildId = 'guild_ticket_test';
  const creatorId = 'ticket_creator_1';
  const channelId = 'chan_ticket_001';

  let ticket = null;

  await t.test('creates ticket with incremental numbering', () => {
    ticket = ticketsRepo.createTicket(guildId, channelId, creatorId);
    assert.ok(ticket);
    assert.equal(ticket.ticketNumber, 1);
    assert.equal(ticket.status, 'open');

    // Create second ticket
    const ticket2 = ticketsRepo.createTicket(guildId, 'chan_ticket_002', 'creator_2');
    assert.equal(ticket2.ticketNumber, 2);
  });

  await t.test('retrieves ticket by channel ID', () => {
    const fetched = ticketsRepo.getTicketByChannel(channelId);
    assert.ok(fetched);
    assert.equal(fetched.id, ticket.id);
    assert.equal(fetched.creator_id, creatorId);
  });

  await t.test('claimTicket assigns staff handler', () => {
    const staffId = 'staff_member_7';
    ticketsRepo.claimTicket(ticket.id, staffId);

    const updated = ticketsRepo.getTicketById(ticket.id);
    assert.equal(updated.claimed_by, staffId);
  });

  await t.test('closeTicket records closure metadata', () => {
    ticketsRepo.closeTicket(ticket.id, 'closer_staff', 'Inquiry answered completely');

    const closed = ticketsRepo.getTicketById(ticket.id);
    assert.equal(closed.status, 'closed');
    assert.equal(closed.closed_by, 'closer_staff');
    assert.equal(closed.close_reason, 'Inquiry answered completely');
    assert.ok(closed.closed_at > 0);
  });

  await t.test('reopenTicket restores active status', () => {
    ticketsRepo.reopenTicket(ticket.id);

    const reopened = ticketsRepo.getTicketById(ticket.id);
    assert.equal(reopened.status, 'open');
    assert.equal(reopened.closed_at, null);
    assert.equal(reopened.closed_by, null);
  });
});
