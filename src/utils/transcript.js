const fs = require('fs');
const path = require('path');
const config = require('../config');
const { escapeHtml } = require('./sanitize');
const logger = require('./logger');
const ticketsRepo = require('../database/repositories/tickets');
const loggingService = require('../services/loggingService');
const { GlassEmbed } = require('./embeds');
const { COLORS, TAGS } = require('../constants');

/**
 * Paginates message history retrieval from a Discord channel with rate limit pacing and safety bounds.
 *
 * @param {import('discord.js').TextChannel} channel - The ticket channel to fetch messages from.
 * @param {object} [options] - Options for retrieval.
 * @param {number} [options.maxMessages=5000] - Hard cap on retrieved messages to avoid memory exhaustion.
 * @param {number} [options.batchLimit=100] - Number of messages to request per API call.
 * @param {number} [options.batchDelayMs=50] - Inter-batch delay to stay well within REST rate limits.
 * @returns {Promise<{ messages: Array, complete: boolean, totalFetched: number, failureReason: string|null }>}
 */
async function fetchTicketMessages(channel, options = {}) {
  const maxMessages = options.maxMessages || 5000;
  const batchLimit = Math.min(options.batchLimit || 100, 100);
  const batchDelayMs = options.batchDelayMs !== undefined ? options.batchDelayMs : 50;

  const allMessages = [];
  let oldestMessageId = null;
  let complete = true;
  let failureReason = null;

  if (!channel || !channel.messages || typeof channel.messages.fetch !== 'function') {
    return {
      messages: [],
      complete: false,
      totalFetched: 0,
      failureReason: 'Channel or message history is inaccessible',
    };
  }

  while (allMessages.length < maxMessages) {
    const fetchOptions = { limit: batchLimit };
    if (oldestMessageId) {
      fetchOptions.before = oldestMessageId;
    }

    let batch;
    try {
      batch = await channel.messages.fetch(fetchOptions);
    } catch (err) {
      complete = false;
      failureReason = `Inaccessible history or API error: ${err.message}`;
      logger.warn(`Ticket message fetch error in channel ${channel.id}: ${err.message}`);
      break;
    }

    if (!batch || batch.size === 0) {
      // Reached the earliest message in the channel
      break;
    }

    // Discord returns messages in reverse chronological order (newest first in batch)
    for (const msg of batch.values()) {
      allMessages.push(msg);
    }

    oldestMessageId = batch.last().id;

    if (batch.size < batchLimit) {
      // Fewer messages returned than requested indicates beginning of history
      break;
    }

    if (allMessages.length >= maxMessages) {
      complete = false;
      failureReason = `Reached maximum export cap of ${maxMessages} messages`;
      break;
    }

    if (batchDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }

  // Sort messages in strict chronological order (oldest first)
  allMessages.sort((a, b) => {
    const timeA = a.createdTimestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = b.createdTimestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeA - timeB;
  });

  return {
    messages: allMessages,
    complete,
    totalFetched: allMessages.length,
    failureReason,
  };
}

/**
 * Generates a dark violet liquid-glass HTML transcript for a ticket with completeness status and safe escaping.
 */
function generateTranscriptHtml({
  ticketNumber,
  guildName,
  channelName,
  creatorTag,
  closedByTag,
  closeReason,
  messages,
  complete = true,
  totalFetched,
  failureReason = null,
}) {
  const totalCount = typeof totalFetched === 'number' ? totalFetched : (messages ? messages.length : 0);

  const renderedMessages = (messages || []).map(msg => {
    const authorName = escapeHtml(msg.author?.tag || msg.author?.username || (msg.author ? `User#${msg.author.id}` : 'Unknown User'));
    const timestamp = msg.createdAt ? new Date(msg.createdAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : '';
    const isBot = msg.author?.bot ? '<span class="badge">BOT</span>' : '';

    let contentHtml = '';
    if (msg.content && msg.content.trim().length > 0) {
      contentHtml = escapeHtml(msg.content);
    } else if (msg.system) {
      contentHtml = `<em>[System Event: ${escapeHtml(msg.type || 'Event')}]</em>`;
    } else if (msg.attachments && msg.attachments.size > 0) {
      contentHtml = '<em>[Attachment-only message]</em>';
    } else {
      contentHtml = '<em>[Empty or Deleted Content]</em>';
    }

    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.size > 0) {
      attachmentsHtml = '<div class="attachments">' +
        Array.from(msg.attachments.values()).map(att => {
          const safeUrl = escapeHtml(att.url || '#');
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
        <div class="message-body">${contentHtml}</div>
        ${attachmentsHtml}
      </div>
    `;
  }).join('\n');

  const statusBadge = complete
    ? '<span class="badge badge-success">COMPLETE ARCHIVE</span>'
    : '<span class="badge badge-warning">PARTIAL / INCOMPLETE</span>';

  const warningBanner = !complete
    ? `<div class="warning-banner"><strong>Notice:</strong> This transcript is incomplete. Messages were omitted or inaccessible. Reason: ${escapeHtml(failureReason || 'Omitted messages')}</div>`
    : '';

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
      flex-wrap: wrap;
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
    .warning-banner {
      background: rgba(202, 138, 4, 0.15);
      border: 1px solid rgba(202, 138, 4, 0.4);
      color: #fde047;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 13px;
    }
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
      padding: 2px 6px;
      border-radius: 4px;
      color: #fff;
      font-family: monospace;
      letter-spacing: 0.5px;
    }
    .badge-success { background: #16a34a !important; }
    .badge-warning { background: #ca8a04 !important; }
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
      <h1><span class="tag">SOLAS CORE</span> Ticket #${ticketNumber} Transcript ${statusBadge}</h1>
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
        <div class="meta-item">
          <div class="meta-label">Total Messages</div>
          <div class="meta-value">${totalCount}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Archive Status</div>
          <div class="meta-value">${complete ? 'Complete' : 'Partial / Incomplete'}</div>
        </div>
        <div class="meta-item" style="grid-column: 1 / -1;">
          <div class="meta-label">Close Reason</div>
          <div class="meta-value">${escapeHtml(closeReason || 'No reason specified')}</div>
        </div>
      </div>
    </div>

    ${warningBanner}

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

/**
 * Executes full ticket archiving: paginated message retrieval, transcript generation,
 * database updates, logging event emission, and dispatching to the configured log channel.
 *
 * @param {object} params
 * @param {import('discord.js').TextChannel} params.channel - The ticket channel
 * @param {object} params.ticket - The ticket DB record
 * @param {import('discord.js').User} params.closedBy - User who triggered the close
 * @param {string} params.reason - Closure reason
 * @param {import('discord.js').Guild} params.guild - Discord guild
 * @param {import('discord.js').Client} params.client - Discord client
 * @returns {Promise<{ transcriptPath: string, complete: boolean, totalFetched: number, failureReason: string|null }>}
 */
async function archiveAndCloseTicket({ channel, ticket, closedBy, reason = 'Ticket closed', guild, client }) {
  const cfg = ticketsRepo.getConfig(guild.id);

  // 1. Paginated message fetch with chronological ordering
  const fetchResult = await fetchTicketMessages(channel);
  const { messages, complete, totalFetched, failureReason } = fetchResult;

  // 2. Fetch creator info
  let creatorTag = 'Unknown User';
  if (client && client.users && typeof client.users.fetch === 'function') {
    const creator = await client.users.fetch(ticket.creator_id).catch(() => null);
    if (creator) {
      creatorTag = creator.tag || creator.username || 'Unknown User';
    }
  }

  // 3. Generate HTML transcript with completeness reporting
  const html = generateTranscriptHtml({
    ticketNumber: ticket.ticket_number,
    guildName: guild.name,
    channelName: channel.name,
    creatorTag,
    closedByTag: closedBy.tag || closedBy.username || 'Staff',
    closeReason: reason,
    messages,
    complete,
    totalFetched,
    failureReason,
  });

  // 4. Save to filesystem
  const transcriptPath = saveTranscript(ticket.ticket_number, guild.id, html);

  // 5. Update ticket record in SQLite
  ticketsRepo.closeTicket(ticket.id, closedBy.id, reason);

  // 6. Audit log entry
  const statusNote = complete
    ? `Complete archive (${totalFetched} messages)`
    : `Incomplete transcript (${totalFetched} messages fetched; reason: ${failureReason})`;
  loggingService.logTicketEvent(guild, 'Closed', ticket, closedBy, `${reason} | ${statusNote}`);

  // 7. Dispatch transcript to configured log channel
  if (cfg.log_channel_id && guild.channels && typeof guild.channels.fetch === 'function') {
    try {
      const logChan = await guild.channels.fetch(cfg.log_channel_id).catch(() => null);
      if (logChan && logChan.isTextBased()) {
        const logEmbed = new GlassEmbed()
          .setColor(complete ? COLORS.PRIMARY : COLORS.WARNING)
          .setGlassTitle(TAGS.TICKET, `Transcript Archived — Ticket #${ticket.ticket_number}`)
          .setGlassDescription(`Ticket session closed and archived.\n\nCreator: <@${ticket.creator_id}>\nClosed By: <@${closedBy.id}>\nReason: **${reason}**`)
          .addGlassField('Total Messages', String(totalFetched), true)
          .addGlassField('Archive Status', complete ? '[Complete Archive]' : '[Partial / Incomplete]', true);

        if (!complete && failureReason) {
          logEmbed.addGlassField('Omission Details', failureReason, false);
        }

        await logChan.send({
          content: `Transcript for Ticket #${ticket.ticket_number} (Creator: <@${ticket.creator_id}>)`,
          embeds: [logEmbed],
          files: [transcriptPath],
        }).catch(err => {
          logger.error(`Could not dispatch transcript to log channel: ${err.message}`);
        });
      }
    } catch (err) {
      logger.error(`Error sending transcript to log channel: ${err.message}`);
    }
  }

  return {
    transcriptPath,
    complete,
    totalFetched,
    failureReason,
  };
}

module.exports = {
  fetchTicketMessages,
  generateTranscriptHtml,
  saveTranscript,
  archiveAndCloseTicket,
};
