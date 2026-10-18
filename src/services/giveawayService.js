const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const giveawaysRepo = require('../database/repositories/giveaways');
const logger = require('../utils/logger');
const { GlassEmbed, infoEmbed, successEmbed } = require('../utils/embeds');
const { COLORS, TAGS } = require('../constants');

const SAFE_SCHEDULE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours (safely below 32-bit limit)
const SWEEPER_INTERVAL_MS = 30 * 1000; // 30 seconds

class GiveawayService {
  constructor() {
    this.timers = new Map();
    this.sweeperInterval = null;
    this.client = null;
  }

  buildGiveawayEmbed(giveaway, entryCount = 0) {
    const embed = new GlassEmbed()
      .setColor(giveaway.ended ? COLORS.NEUTRAL : COLORS.PRIMARY)
      .setGlassTitle(TAGS.GIVEAWAY, giveaway.prize);

    if (giveaway.ended) {
      const winnerList = giveaway.winners && giveaway.winners.length > 0
        ? giveaway.winners.map(id => `<@${id}>`).join(', ')
        : '[No Valid Entries]';

      embed.setGlassDescription(`This giveaway has concluded.\n\nPrize: **${giveaway.prize}**\nWinners: ${winnerList}`);
      embed.addGlassField('Status', '[Ended]', true);
      embed.addGlassField('Total Entries', String(entryCount), true);
    } else {
      const unixEnd = Math.floor(giveaway.end_time / 1000);
      embed.setGlassDescription(`Prize: **${giveaway.prize}**\nEnds: <t:${unixEnd}:R> (<t:${unixEnd}:f>)\nWinners: **${giveaway.winner_count}**`);
      embed.addGlassField('Entries', String(entryCount), true);
      embed.addGlassField('Hosted By', `<@${giveaway.created_by}>`, true);
    }

    return embed;
  }

  buildGiveawayButton(giveawayId, entryCount = 0, disabled = false) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_entry:${giveawayId}`)
        .setLabel(`Enter Giveaway (${entryCount})`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    );
  }

  startSweeper(client) {
    this.client = client;
    if (this.sweeperInterval) {
      clearInterval(this.sweeperInterval);
    }

    this.sweepGiveaways(client);
    this.sweeperInterval = setInterval(() => {
      this.sweepGiveaways(this.client);
    }, SWEEPER_INTERVAL_MS);

    if (typeof this.sweeperInterval.unref === 'function') {
      this.sweeperInterval.unref();
    }
  }

  stopSweeper() {
    if (this.sweeperInterval) {
      clearInterval(this.sweeperInterval);
      this.sweeperInterval = null;
    }

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  sweepGiveaways(client) {
    if (!client) return;
    try {
      const active = giveawaysRepo.getActiveGiveaways();
      const now = Date.now();

      for (const giveaway of active) {
        const remainingMs = giveaway.end_time - now;
        if (remainingMs <= 0) {
          this.resolveGiveaway(giveaway.id, client);
        } else if (remainingMs <= SAFE_SCHEDULE_WINDOW && !this.timers.has(giveaway.id)) {
          const timer = setTimeout(() => {
            this.resolveGiveaway(giveaway.id, client);
          }, remainingMs);
          this.timers.set(giveaway.id, timer);
        }
      }
    } catch (err) {
      logger.error(`Error in giveaway sweeper: ${err.message}`);
    }
  }

  scheduleGiveaway(giveaway, client) {
    if (!giveaway || giveaway.ended) return;

    if (this.timers.has(giveaway.id)) {
      clearTimeout(this.timers.get(giveaway.id));
      this.timers.delete(giveaway.id);
    }

    const remainingMs = giveaway.end_time - Date.now();

    if (remainingMs <= 0) {
      // Past deadline, resolve immediately
      this.resolveGiveaway(giveaway.id, client);
    } else if (remainingMs <= SAFE_SCHEDULE_WINDOW) {
      const timer = setTimeout(() => {
        this.resolveGiveaway(giveaway.id, client);
      }, remainingMs);
      this.timers.set(giveaway.id, timer);
    } else {
      // Long-duration giveaway: persistent deadline saved in DB, periodic sweeper will handle it
      logger.debug(`Giveaway #${giveaway.id} deadline is ${remainingMs}ms in future; registered for background sweeper.`);
    }
  }

  async resolveGiveaway(giveawayId, client) {
    this.timers.delete(giveawayId);

    // Atomically end giveaway in DB - returns null if already ended
    const finalized = giveawaysRepo.atomicEndGiveaway(giveawayId);
    if (!finalized) {
      return; // Already resolved, preventing duplicate winner selection and announcements
    }

    try {
      const guild = await client.guilds.fetch(finalized.guild_id).catch(() => null);
      if (!guild) return;

      const channel = await guild.channels.fetch(finalized.channel_id).catch(() => null);
      if (!channel) return;

      const entryCount = giveawaysRepo.getEntryCount(giveawayId);
      const message = await channel.messages.fetch(finalized.message_id).catch(() => null);

      if (message) {
        const endedEmbed = this.buildGiveawayEmbed(finalized, entryCount);
        const disabledButton = this.buildGiveawayButton(giveawayId, entryCount, true);
        await message.edit({ embeds: [endedEmbed], components: [disabledButton] }).catch(() => {});
      }

      // Announce winners
      if (finalized.winners.length > 0) {
        const winnerPings = finalized.winners.map(id => `<@${id}>`).join(' ');
        const announceEmbed = successEmbed(
          'Giveaway Concluded',
          `Prize: **${finalized.prize}**\nWinners: ${winnerPings}\nTotal Entries: **${entryCount}**`
        );
        await channel.send({ content: winnerPings, embeds: [announceEmbed] });
      } else {
        const noWinnerEmbed = infoEmbed(
          'Giveaway Concluded',
          `Prize: **${finalized.prize}**\nResult: No valid entries were submitted.`
        );
        await channel.send({ embeds: [noWinnerEmbed] });
      }
    } catch (err) {
      logger.error(`Error announcing giveaway ${giveawayId}: ${err.message}`);
    }
  }

  recoverActiveGiveaways(client) {
    if (client) {
      this.startSweeper(client);
    }
    const active = giveawaysRepo.getActiveGiveaways();
    logger.info(`Recovering ${active.length} active giveaway(s) after startup.`);

    for (const giveaway of active) {
      this.scheduleGiveaway(giveaway, client);
    }
  }

  cancelGiveaway(giveawayId) {
    if (this.timers.has(giveawayId)) {
      clearTimeout(this.timers.get(giveawayId));
      this.timers.delete(giveawayId);
    }
    return giveawaysRepo.cancelGiveaway(giveawayId);
  }
}

module.exports = new GiveawayService();
