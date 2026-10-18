const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { generateTranscriptHtml, saveTranscript } = require('../src/utils/transcript');
const { escapeHtml } = require('../src/utils/sanitize');

test('HTML Ticket Transcripts & Safe Escaping', async (t) => {
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
    });

    assert.ok(html.includes('Ticket #42 Transcript'));
    assert.ok(html.includes('Test Server &amp; Co &lt;script&gt;'));
    assert.ok(html.includes('&lt;script&gt;evilPayload()&lt;/script&gt;'));
    assert.equal(html.includes('<script>evilPayload()</script>'), false);
    assert.ok(html.includes('log.txt'));
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
});
