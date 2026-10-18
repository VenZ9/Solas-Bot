const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { fetchTicketMessages, generateTranscriptHtml, saveTranscript, archiveAndCloseTicket } = require('../src/utils/transcript');
const { escapeHtml } = require('../src/utils/sanitize');
const { initDatabase, closeDatabase } = require('../src/database');
const ticketsRepo = require('../src/database/repositories/tickets');

test('HTML Ticket Transcripts, Safe Escaping, & Pagination', async (t) => {
  await t.test('escapeHtml eliminates XSS injection vectors', () => {
    const malicious = '<script>alert("XSS")</script>&foo=\'bar\'';
    const escaped = escapeHtml(malicious);

    assert.equal(escaped.includes('<script>'), false);
    assert.equal(escaped.includes('</script>'), false);
    assert.equal(escaped.includes('&amp;'), true);
    assert.equal(escaped.includes('&quot;'), true);
    assert.equal(escaped.includes('&#39;'), true);
  });

  await t.test('generates styled transcript with safe escaping for messages and metadata', () => {
    const messages = [
      {
        author: { tag: 'User<Malicious>', username: 'User<Malicious>', bot: false },
        createdAt: new Date('2026-10-18T10:00:00Z'),
        content: 'Hello, <script>evilPayload()</script> test message.',
        attachments: new Map(),
      },
      {
        author: { tag: 'StaffMember#0001', username: 'StaffMember', bot: false },
        createdAt: new Date('2026-10-18T10:01:00Z'),
        content: 'We are investigating your request.',
        attachments: new Map([
          ['1', { url: 'https://example.com/log.txt', name: 'log.txt' }],
        ]),
      },
    ];

    const html = generateTranscriptHtml({
      ticketNumber: 42,
      guildName: 'Test Server & Co <script>',
      channelName: 'ticket-0042',
      creatorTag: 'User<Malicious>',
      closedByTag: 'StaffMember#0001',
      closeReason: 'Resolved successfully',
      messages,
      complete: true,
      totalFetched: 2,
    });

    assert.ok(html.includes('Ticket #42 Transcript'));
    assert.ok(html.includes('COMPLETE ARCHIVE'));
    assert.ok(html.includes('Total Messages'));
    assert.ok(html.includes('Test Server &amp; Co &lt;script&gt;'));
    assert.ok(html.includes('&lt;script&gt;evilPayload()&lt;/script&gt;'));
    assert.equal(html.includes('<script>evilPayload()</script>'), false);
    assert.ok(html.includes('log.txt'));
  });

  await t.test('handles incomplete transcripts honestly with clear warning banner and partial status', () => {
    const messages = [
      {
        author: { tag: 'User#1234', username: 'User', bot: false },
        createdAt: new Date('2026-10-18T10:00:00Z'),
        content: 'Only message retrieved before fetch failure',
        attachments: new Map(),
      },
    ];

    const html = generateTranscriptHtml({
      ticketNumber: 99,
      guildName: 'Support Server',
      channelName: 'ticket-0099',
      creatorTag: 'User#1234',
      closedByTag: 'Staff#0001',
      closeReason: 'Incomplete close test',
      messages,
      complete: false,
      totalFetched: 1,
      failureReason: 'Missing Permissions to view older message history',
    });

    assert.ok(html.includes('PARTIAL / INCOMPLETE'));
    assert.ok(html.includes('warning-banner'));
    assert.ok(html.includes('Missing Permissions to view older message history'));
  });

  await t.test('gracefully formats empty, deleted, or system messages', () => {
    const messages = [
      {
        author: null,
        createdAt: null,
        content: '',
        attachments: new Map(),
      },
      {
        author: { tag: 'SystemBot', bot: true },
        createdAt: new Date('2026-10-18T10:05:00Z'),
        content: '',
        system: true,
        type: 'ChannelPinnedMessage',
        attachments: new Map(),
      },
    ];

    const html = generateTranscriptHtml({
      ticketNumber: 101,
      guildName: 'Guild',
      channelName: 'ticket-0101',
      creatorTag: 'Creator',
      closedByTag: 'Staff',
      closeReason: 'Test',
      messages,
      complete: true,
    });

    assert.ok(html.includes('[Empty or Deleted Content]'));
    assert.ok(html.includes('[System Event: ChannelPinnedMessage]'));
  });

  await t.test('saves transcript to file system', () => {
    const sampleHtml = '<html><body>Ticket Test Content</body></html>';
    const filePath = saveTranscript(999, 'test_guild', sampleHtml);

    assert.ok(fs.existsSync(filePath));
    const content = fs.readFileSync(filePath, 'utf8');
    assert.equal(content, sampleHtml);

    // Clean up
    fs.unlinkSync(filePath);
  });

  await t.test('fetchTicketMessages paginates across batches and sorts in chronological order', async () => {
    // Simulate a channel with 250 messages (requiring 3 paginated fetch calls)
    const mockMessages = [];
    for (let i = 1; i <= 250; i++) {
      mockMessages.push({
        id: String(1000 + i),
        content: `Message ${i}`,
        createdTimestamp: 1700000000000 + (i * 1000),
        createdAt: new Date(1700000000000 + (i * 1000)),
        author: { id: 'user_1', tag: 'User#1', bot: false },
        attachments: new Map(),
      });
    }

    const mockChannel = {
      id: 'channel_123',
      messages: {
        async fetch(options) {
          const limit = options.limit || 100;
          let pool = [...mockMessages];

          if (options.before) {
            const idx = pool.findIndex(m => m.id === options.before);
            if (idx !== -1) {
              pool = pool.slice(0, idx);
            }
          }

          // Discord API returns newest first
          const slice = pool.slice(-limit).reverse();
          return {
            size: slice.length,
            values: () => slice.values(),
            last: () => slice[slice.length - 1],
          };
        },
      },
    };

    const result = await fetchTicketMessages(mockChannel, { batchLimit: 100, batchDelayMs: 0 });

    assert.equal(result.complete, true);
    assert.equal(result.totalFetched, 250);
    assert.equal(result.failureReason, null);

    // Verify chronological ordering: earliest message first
    assert.equal(result.messages[0].content, 'Message 1');
    assert.equal(result.messages[result.messages.length - 1].content, 'Message 250');
  });

  await t.test('fetchTicketMessages handles API errors and marks transcript as incomplete', async () => {
    const mockChannel = {
      id: 'error_channel',
      messages: {
        async fetch() {
          throw new Error('Missing Access: Cannot read channel history');
        },
      },
    };

    const result = await fetchTicketMessages(mockChannel, { batchLimit: 100, batchDelayMs: 0 });

    assert.equal(result.complete, false);
    assert.equal(result.totalFetched, 0);
    assert.ok(result.failureReason.includes('Missing Access'));
  });

  await t.test('archiveAndCloseTicket completes full workflow and updates database', async () => {
    closeDatabase();
    initDatabase(':memory:');

    const guildId = 'guild_archive_test';
    const channelId = 'chan_ticket_test';
    const creatorId = 'creator_test_user';
    const ticket = ticketsRepo.createTicket(guildId, channelId, creatorId);

    const mockChannel = {
      id: channelId,
      name: 'ticket-0001',
      messages: {
        async fetch() {
          const msgs = [
            {
              id: 'msg_1',
              content: 'User help request',
              createdTimestamp: 1700000000000,
              createdAt: new Date(1700000000000),
              author: { id: creatorId, tag: 'User#0001', bot: false },
              attachments: new Map(),
            },
          ];
          return {
            size: msgs.length,
            values: () => msgs.values(),
            last: () => msgs[msgs.length - 1],
          };
        },
      },
    };

    const mockGuild = {
      id: guildId,
      name: 'Test Guild',
      channels: {
        async fetch() { return null; },
      },
    };

    const mockClient = {
      users: {
        async fetch() { return { tag: 'User#0001' }; },
      },
    };

    const result = await archiveAndCloseTicket({
      channel: mockChannel,
      ticket,
      closedBy: { id: 'staff_1', tag: 'Staff#0001' },
      reason: 'Issue resolved cleanly',
      guild: mockGuild,
      client: mockClient,
    });

    assert.equal(result.complete, true);
    assert.equal(result.totalFetched, 1);
    assert.ok(fs.existsSync(result.transcriptPath));

    // Verify DB record is closed
    const updatedTicket = ticketsRepo.getTicketById(ticket.id);
    assert.equal(updatedTicket.status, 'closed');
    assert.equal(updatedTicket.closed_by, 'staff_1');
    assert.equal(updatedTicket.close_reason, 'Issue resolved cleanly');

    // Clean up transcript
    fs.unlinkSync(result.transcriptPath);
    closeDatabase();
  });
});
