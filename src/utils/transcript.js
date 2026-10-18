const fs = require('fs');
const path = require('path');
const config = require('../config');
const { escapeHtml } = require('./sanitize');

/**
 * Generates a polished, dark violet liquid-glass HTML transcript for a ticket
 */
function generateTranscriptHtml({ ticketNumber, guildName, channelName, creatorTag, closedByTag, closeReason, messages }) {
  const renderedMessages = messages.map(msg => {
    const authorName = escapeHtml(msg.author?.tag || msg.author?.username || 'Unknown User');
    const timestamp = msg.createdAt ? new Date(msg.createdAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : '';
    const content = escapeHtml(msg.content || '');
    const isBot = msg.author?.bot ? '<span class="badge">BOT</span>' : '';

    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.size > 0) {
      attachmentsHtml = '<div class="attachments">' +
        Array.from(msg.attachments.values()).map(att => {
          const safeUrl = escapeHtml(att.url);
          const safeName = escapeHtml(att.name || 'Attachment');
          return `<a href="${safeUrl}" target="_blank" class="attachment-link">[Attachment: ${safeName}]</a>`;
        }).join('') +
        '</div>';
    }

    return `
      <div class="message-row">
        <div class="message-meta">
          <span class="author">${authorName}</span>
          ${isBot}
          <span class="timestamp">${timestamp}</span>
        </div>
        <div class="message-body">${content || '<em>[No text content]</em>'}</div>
        ${attachmentsHtml}
      </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket #${ticketNumber} Transcript - ${escapeHtml(guildName)}</title>
  <style>
    :root {
      --bg-base: #09090b;
      --bg-card: rgba(24, 24, 37, 0.75);
      --border-glass: rgba(139, 92, 246, 0.25);
      --accent-violet: #7c3aed;
      --accent-soft: #a78bfa;
      --text-main: #f4f4f5;
      --text-muted: #a1a1aa;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-base);
      background-image: radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.15), transparent 70%);
      color: var(--text-main);
      padding: 30px 20px;
      line-height: 1.5;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header-card {
      background: var(--bg-card);
      border: 1px solid var(--border-glass);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    .header-card h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #fff;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-card h1 .tag {
      background: var(--accent-violet);
      color: #fff;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: monospace;
    }
    .grid-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 16px;
      font-size: 13px;
    }
    .meta-item {
      background: rgba(255, 255, 255, 0.03);
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 2px solid var(--accent-violet);
    }
    .meta-label { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-value { font-weight: 600; color: #fff; margin-top: 2px; }
    .messages-container {
      background: var(--bg-card);
      border: 1px solid var(--border-glass);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .message-row {
      padding: 12px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }
    .message-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .author { font-weight: 600; color: var(--accent-soft); }
    .badge {
      background: #4f46e5;
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      color: #fff;
    }
    .timestamp { color: var(--text-muted); font-size: 11px; margin-left: auto; font-family: monospace; }
    .message-body {
      font-size: 14px;
      color: #e4e4e7;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .attachments {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .attachment-link {
      color: var(--accent-soft);
      text-decoration: none;
      font-size: 12px;
      font-family: monospace;
    }
    .attachment-link:hover { text-decoration: underline; }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: var(--text-muted);
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-card">
      <h1><span class="tag">SOLAS CORE</span> Ticket #${ticketNumber} Transcript</h1>
      <div class="grid-meta">
        <div class="meta-item">
          <div class="meta-label">Server</div>
          <div class="meta-value">${escapeHtml(guildName)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Channel</div>
          <div class="meta-value">${escapeHtml(channelName)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Created By</div>
          <div class="meta-value">${escapeHtml(creatorTag)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Closed By</div>
          <div class="meta-value">${escapeHtml(closedByTag)}</div>
        </div>
        <div class="meta-item" style="grid-column: 1 / -1;">
          <div class="meta-label">Close Reason</div>
          <div class="meta-value">${escapeHtml(closeReason || 'No reason specified')}</div>
        </div>
      </div>
    </div>

    <div class="messages-container">
      ${renderedMessages || '<div class="message-row"><em>[No messages recorded in ticket]</em></div>'}
    </div>

    <div class="footer">
      Generated by Solas &bull; Liquid-Glass Modular Bot Core &bull; ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Saves transcript to disk and returns absolute file path
 */
function saveTranscript(ticketNumber, guildId, htmlContent) {
  const filename = `transcript_ticket_${ticketNumber}_${guildId}_${Date.now()}.html`;
  const filePath = path.join(config.transcriptsDir, filename);
  fs.writeFileSync(filePath, htmlContent, 'utf8');
  return filePath;
}

module.exports = {
  generateTranscriptHtml,
  saveTranscript,
};
