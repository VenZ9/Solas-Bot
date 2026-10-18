const { EmbedBuilder } = require('discord.js');
const { COLORS, DIVIDER, FOOTER_TEXT, TAGS } = require('../constants');

// Regex to detect and eliminate any emojis (Unicode emoji property + Discord custom emoji format)
const EMOJI_REGEX = /(\p{Extended_Pictographic}|<a?:[a-zA-Z0-9_]+:[0-9]+>)/gu;

function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(EMOJI_REGEX, '').trim();
}

class GlassEmbed extends EmbedBuilder {
  constructor(data = {}) {
    super(data);
    this.setColor(COLORS.PRIMARY);
    this.setFooter({ text: FOOTER_TEXT });
    this.setTimestamp();
  }

  setGlassTitle(tag, title) {
    const cleanTitle = sanitizeText(title);
    return super.setTitle(`${tag} ${cleanTitle}`.trim());
  }

  setGlassDescription(description) {
    const clean = sanitizeText(description);
    return super.setDescription(`> ${clean.split('\n').join('\n> ')}\n\n${DIVIDER}`);
  }

  addGlassField(name, value, inline = false) {
    const cleanName = sanitizeText(name);
    const cleanVal = sanitizeText(value);
    return super.addFields({ name: cleanName, value: cleanVal || '[None]', inline });
  }
}

function successEmbed(title, description, fields = []) {
  const embed = new GlassEmbed()
    .setColor(COLORS.SUCCESS)
    .setGlassTitle(TAGS.SUCCESS, title)
    .setGlassDescription(description);

  for (const f of fields) {
    embed.addGlassField(f.name, f.value, f.inline);
  }
  return embed;
}

function errorEmbed(title, description, fields = []) {
  const embed = new GlassEmbed()
    .setColor(COLORS.ERROR)
    .setGlassTitle(TAGS.ERROR, title)
    .setGlassDescription(description);

  for (const f of fields) {
    embed.addGlassField(f.name, f.value, f.inline);
  }
  return embed;
}

function warningEmbed(title, description, fields = []) {
  const embed = new GlassEmbed()
    .setColor(COLORS.WARNING)
    .setGlassTitle(TAGS.WARNING, title)
    .setGlassDescription(description);

  for (const f of fields) {
    embed.addGlassField(f.name, f.value, f.inline);
  }
  return embed;
}

function infoEmbed(title, description, fields = []) {
  const embed = new GlassEmbed()
    .setColor(COLORS.PRIMARY)
    .setGlassTitle(TAGS.SYSTEM, title)
    .setGlassDescription(description);

  for (const f of fields) {
    embed.addGlassField(f.name, f.value, f.inline);
  }
  return embed;
}

function panelEmbed(title, description, fields = []) {
  const embed = new GlassEmbed()
    .setColor(COLORS.PRIMARY)
    .setGlassTitle(TAGS.SYSTEM, title)
    .setGlassDescription(description);

  for (const f of fields) {
    embed.addGlassField(f.name, f.value, f.inline);
  }
  return embed;
}

module.exports = {
  GlassEmbed,
  sanitizeText,
  successEmbed,
  errorEmbed,
  warningEmbed,
  infoEmbed,
  panelEmbed,
};
