const levelingRepo = require('../database/repositories/leveling');
const logger = require('../utils/logger');
const { infoEmbed } = require('../utils/embeds');

class LevelingService {
  constructor() {
    this.cooldowns = new Map();
    this.lastCleanup = Date.now();
  }

  cleanCooldowns() {
    const now = Date.now();
    if (now - this.lastCleanup < 60000 && this.cooldowns.size < 2000) return;

    for (const [key, expireTime] of this.cooldowns.entries()) {
      if (now > expireTime) {
        this.cooldowns.delete(key);
      }
    }
    this.lastCleanup = now;
  }

  async handleMessage(message) {
    if (!message.guild || !message.member || message.author.bot) return;

    const config = levelingRepo.getConfig(message.guild.id);
    if (!config.enabled) return;

    if (config.exempt_channels.includes(message.channel.id)) return;

    this.cleanCooldowns();

    const key = `${message.author.id}_${message.guild.id}`;
    const now = Date.now();
    const cooldownExpiry = this.cooldowns.get(key) || 0;

    if (now < cooldownExpiry) {
      return; // Cooldown active
    }

    // Set cooldown
    const cooldownMs = (config.cooldown_seconds || 60) * 1000;
    this.cooldowns.set(key, now + cooldownMs);

    // Random XP between 15 and 25 multiplied by rate
    const rawXp = Math.floor(Math.random() * 11) + 15;
    const earnedXp = Math.round(rawXp * (config.xp_rate || 1.0));

    const result = levelingRepo.addXp(message.guild.id, message.author.id, earnedXp);

    if (result.leveledUp) {
      await this.handleLevelUp(message, result.newLevel);
    }
  }

  async handleLevelUp(message, newLevel) {
    const { guild, member, channel, author } = message;

    // Award role rewards idempotently
    try {
      const rewards = levelingRepo.getEligibleRewards(guild.id, newLevel);
      const botMember = guild.members.me;

      for (const r of rewards) {
        if (!member.roles.cache.has(r.role_id)) {
          const role = guild.roles.cache.get(r.role_id);
          if (role && botMember && botMember.permissions.has('ManageRoles')) {
            if (role.position < botMember.roles.highest.position && !role.managed) {
              await member.roles.add(role.id).catch(err => {
                logger.warn(`Failed to assign level reward role ${role.id}: ${err.message}`);
              });
            }
          }
        }
      }
    } catch (err) {
      logger.warn(`Error processing level rewards for ${author.id}: ${err.message}`);
    }

    // Send clean level up notification
    try {
      const embed = infoEmbed(
        'Level Progression',
        `Congratulations <@${author.id}>, you have reached **Level ${newLevel}**.`
      );
      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn(`Could not send level up embed: ${err.message}`);
    }
  }
}

module.exports = new LevelingService();
