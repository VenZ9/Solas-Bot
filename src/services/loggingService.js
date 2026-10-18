const loggingRepo = require('../database/repositories/logging');
const logger = require('../utils/logger');
const { GlassEmbed } = require('../utils/embeds');
const { COLORS, TAGS } = require('../constants');

class LoggingService {
  async sendLog(guild, eventType, buildEmbedFn) {
    if (!guild) return;

    const config = loggingRepo.getConfig(guild.id);
    if (!config.channel_id) return;

    const eventColumnMap = {
      edits: 'log_edits',
      deletes: 'log_deletes',
      joins: 'log_joins',
      leaves: 'log_leaves',
      roles: 'log_roles',
      channels: 'log_channels',
      mod: 'log_mod',
      tickets: 'log_tickets',
      config: 'log_config',
    };

    const column = eventColumnMap[eventType];
    if (column && !config[column]) {
      return; // Event logging disabled
    }

    try {
      const channel = await guild.channels.fetch(config.channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const embed = buildEmbedFn();
      if (embed) {
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      logger.warn(`Logging error in guild ${guild.id}: ${err.message}`);
    }
  }

  logMessageDelete(message) {
    if (!message.guild || message.author?.bot) return;

    this.sendLog(message.guild, 'deletes', () => {
      const embed = new GlassEmbed()
        .setColor(COLORS.ERROR)
        .setGlassTitle(TAGS.LOG, 'Message Deleted')
        .addGlassField('Author', message.author ? `<@${message.author.id}> (${message.author.tag})` : '[Unknown User]', true)
        .addGlassField('Channel', `<#${message.channel.id}>`, true);

      // Respect intents & cache: Do not pretend deleted content is recoverable if uncached
      if (message.content && message.content.length > 0) {
        embed.setGlassDescription(`Content:\n${message.content.substring(0, 1000)}`);
      } else {
        embed.setGlassDescription('[Content Not Cached Prior To Deletion / Embed Or Attachment Only]');
      }

      return embed;
    });
  }

  logMessageUpdate(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    this.sendLog(newMessage.guild, 'edits', () => {
      const embed = new GlassEmbed()
        .setColor(COLORS.INFO)
        .setGlassTitle(TAGS.LOG, 'Message Edited')
        .addGlassField('Author', `<@${newMessage.author.id}>`, true)
        .addGlassField('Channel', `<#${newMessage.channel.id}>`, true)
        .addGlassField('Jump Link', `[Go to message](${newMessage.url})`, false);

      const before = oldMessage.content ? oldMessage.content.substring(0, 500) : '[Uncached Before]';
      const after = newMessage.content ? newMessage.content.substring(0, 500) : '[Empty After]';

      embed.setGlassDescription(`**Before:**\n${before}\n\n**After:**\n${after}`);
      return embed;
    });
  }

  logMemberJoin(member) {
    this.sendLog(member.guild, 'joins', () => {
      const createdUnix = Math.floor(member.user.createdTimestamp / 1000);
      return new GlassEmbed()
        .setColor(COLORS.SUCCESS)
        .setGlassTitle(TAGS.LOG, 'Member Joined')
        .setGlassDescription(`User: <@${member.id}> (${member.user.tag})\nAccount Created: <t:${createdUnix}:R>\nMember Count: ${member.guild.memberCount}`);
    });
  }

  logMemberLeave(member) {
    this.sendLog(member.guild, 'leaves', () => {
      return new GlassEmbed()
        .setColor(COLORS.WARNING)
        .setGlassTitle(TAGS.LOG, 'Member Left')
        .setGlassDescription(`User: <@${member.id}> (${member.user.tag})\nMember Count: ${member.guild.memberCount}`);
    });
  }

  logModAction(guild, actionType, moderator, target, reason, duration) {
    this.sendLog(guild, 'mod', () => {
      const embed = new GlassEmbed()
        .setColor(COLORS.WARNING)
        .setGlassTitle(TAGS.AUDIT, `Moderation Action: ${actionType}`)
        .addGlassField('Moderator', `<@${moderator.id}> (${moderator.tag || moderator.username})`, true)
        .addGlassField('Target', `<@${target.id}> (${target.tag || target.username || target.id})`, true);

      if (duration) {
        embed.addGlassField('Duration', duration, true);
      }
      embed.setGlassDescription(`Reason: ${reason || 'No reason specified'}`);
      return embed;
    });
  }

  logTicketEvent(guild, eventName, ticket, user, details = '') {
    this.sendLog(guild, 'tickets', () => {
      return new GlassEmbed()
        .setColor(COLORS.PRIMARY)
        .setGlassTitle(TAGS.TICKET, `Ticket #${ticket.ticket_number || ticket.ticketNumber}: ${eventName}`)
        .setGlassDescription(`Actor: <@${user.id}>\nChannel: <#${ticket.channel_id || ticket.channelId}>\nDetails: ${details || 'None'}`);
    });
  }

  logConfigChange(guild, adminUser, settingName, oldValue, newValue) {
    this.sendLog(guild, 'config', () => {
      return new GlassEmbed()
        .setColor(COLORS.SECONDARY)
        .setGlassTitle(TAGS.SECURITY, 'Configuration Changed')
        .setGlassDescription(`Staff: <@${adminUser.id}>\nSetting: **${settingName}**\nFrom: \`${oldValue}\`\nTo: \`${newValue}\``);
    });
  }
}

module.exports = new LoggingService();
