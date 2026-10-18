const automodRepo = require('../database/repositories/automod');
const moderationRepo = require('../database/repositories/moderation');
const { LIMITS } = require('../constants');
const logger = require('../utils/logger');
const { errorEmbed, warningEmbed } = require('../utils/embeds');

class AutomodService {
  constructor() {
    // Bounded memory tracking: Map<userId_guildId, { timestamps: number[] }>
    this.messageHistory = new Map();
    this.lastCleanup = Date.now();
  }

  // Periodic cleanup to guarantee bounded memory on 512MB shared host
  cleanStaleEntries() {
    const now = Date.now();
    if (now - this.lastCleanup < 60000 && this.messageHistory.size < LIMITS.AUTOMOD_CACHE_MAX_USERS) {
      return;
    }

    const cutoff = now - LIMITS.AUTOMOD_CACHE_TTL_MS;
    for (const [key, data] of this.messageHistory.entries()) {
      data.timestamps = data.timestamps.filter(t => t > cutoff);
      if (data.timestamps.length === 0) {
        this.messageHistory.delete(key);
      }
    }

    // Hard limit cap
    if (this.messageHistory.size > LIMITS.AUTOMOD_CACHE_MAX_USERS) {
      const keysToDelete = Array.from(this.messageHistory.keys()).slice(0, 200);
      for (const k of keysToDelete) {
        this.messageHistory.delete(k);
      }
    }

    this.lastCleanup = now;
  }

  clearCache() {
    const size = this.messageHistory.size;
    this.messageHistory.clear();
    this.lastCleanup = Date.now();
    return size;
  }

  isExempt(member, channel, config) {
    if (!member || member.user.bot) return true;
    if (member.guild.ownerId === member.id) return true;
    if (member.permissions.has('Administrator') || member.permissions.has('ManageGuild')) return true;

    // Check exempt channels
    if (config.exempt_channels.includes(channel.id)) return true;

    // Check exempt roles
    const memberRoles = member.roles.cache;
    if (config.exempt_roles.some(roleId => memberRoles.has(roleId))) return true;

    return false;
  }

  async handleMessage(message) {
    // Prevent recursive loops and ignore bots/webhooks/DMs
    if (!message.guild || !message.member || message.author.bot || message.webhookId) {
      return;
    }

    const config = automodRepo.getConfig(message.guild.id);
    if (!config.mentions_enabled && !config.spam_enabled) {
      return;
    }

    if (this.isExempt(message.member, message.channel, config)) {
      return;
    }

    this.cleanStaleEntries();

    // 1. Mass-Mentions Check
    if (config.mentions_enabled) {
      const mentionCount = message.mentions.users.size + message.mentions.roles.size;
      if (mentionCount >= config.mention_threshold) {
        await this.punish(
          message,
          'Mass-Mentions Detected',
          `Included ${mentionCount} mentions (threshold: ${config.mention_threshold})`,
          config.mention_action,
          config.mention_duration
        );
        return;
      }
    }

    // 2. Spam / Flood Check
    if (config.spam_enabled) {
      const key = `${message.author.id}_${message.guild.id}`;
      const now = Date.now();
      let record = this.messageHistory.get(key);

      if (!record) {
        record = { timestamps: [] };
        this.messageHistory.set(key, record);
      }

      const windowStart = now - (config.spam_seconds * 1000);
      record.timestamps = record.timestamps.filter(t => t > windowStart);
      record.timestamps.push(now);

      if (record.timestamps.length >= config.spam_messages) {
        // Reset user bucket to prevent duplicate triggers
        this.messageHistory.delete(key);
        await this.punish(
          message,
          'Rapid Spam / Flood Detected',
          `Sent ${record.timestamps.length} messages within ${config.spam_seconds} seconds`,
          config.spam_action,
          config.spam_duration
        );
      }
    }
  }

  async punish(message, reason, details, action, durationSec) {
    const { guild, member, channel, author } = message;

    // Try deleting the offensive message
    try {
      if (message.deletable) {
        await message.delete();
      }
    } catch (err) {
      logger.warn(`Failed to delete spam message: ${err.message}`);
    }

    moderationRepo.addWarning(guild.id, author.id, guild.client.user.id, `[AUTOMOD] ${reason}: ${details}`);

    if (action === 'timeout' && durationSec > 0) {
      try {
        const botMember = guild.members.me;
        if (botMember && botMember.permissions.has('ModerateMembers') && member.moderatable) {
          await member.timeout(durationSec * 1000, `[AUTOMOD] ${reason}`);
        }
      } catch (err) {
        logger.warn(`Automod timeout error: ${err.message}`);
      }
    }

    // Send ephemeral or temporary notification
    try {
      const embed = warningEmbed(
        'Automod Enforcement',
        `User <@${author.id}> triggered automod protection.\n\nReason: ${reason}\nDetails: ${details}\nAction: ${action.toUpperCase()}`
      );
      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn(`Could not send automod notification: ${err.message}`);
    }
  }
}

module.exports = new AutomodService();
