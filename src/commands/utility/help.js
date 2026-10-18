const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');

const CATEGORIES = {
  moderation: {
    name: 'Moderation',
    description: 'Enforce server security, manage member punishments, and maintain order.',
    commands: [
      '`/moderation-panel` - Interactive moderation overview & controls',
      '`/ban <target> [reason] [delete_days]` - Ban a member with confirmation verification',
      '`/unban <user_id> [reason]` - Safely unban by Discord User ID',
      '`/kick <target> [reason]` - Kick a member with confirmation verification',
      '`/timeout <target> <duration> [reason]` - Restrict communication (up to 28 days)',
      '`/untimeout <target> [reason]` - Lift active member timeout',
      '`/warn <target> <reason>` - Issue and persist formal warnings',
      '`/warnings view|clear|remove` - Inspect or manage member warning records',
      '`/purge <amount> [user] [filter]` - Filtered bulk message deletion',
      '`/slowmode <duration> [channel]` - Channel rate-limit control',
      '`/lock [channel] [reason]` - Channel lockdown for @everyone',
      '`/unlock [channel]` - Restore channel messaging permissions',
      '`/nickname <target> [nickname]` - Update or reset server member nicknames',
      '`/role add|remove <user> <role>` - Hierarchy-checked role assignments',
    ],
  },
  automod: {
    name: 'Automod',
    description: 'High-speed protection against mass mentions and rapid message flooding.',
    commands: [
      '`/automod status` - View current filter thresholds and exempt entities',
      '`/automod mentions` - Configure mass-mention limits and automated actions',
      '`/automod spam` - Configure message velocity and flood thresholds',
      '`/automod exempt-role` - Add or remove role exemptions',
      '`/automod exempt-channel` - Add or remove channel exemptions',
      '`/automod disable` - Disable specific automod filters',
    ],
  },
  tickets: {
    name: 'Tickets',
    description: 'Private support channels with claim/close workflows and HTML transcripts.',
    commands: [
      '`/ticket-panel` - Publish persistent interactive ticket creation panel',
      '`/ticket close [reason]` - Close ticket and generate dark-mode HTML transcript',
      '`/ticket claim` - Claim ticket ownership as support staff',
      '`/ticket reopen` - Restore closed ticket session',
      '`/ticket add-user|remove-user` - Manage ticket participant permissions',
      '`/ticket config category|staff-role|log-channel` - Configure ticket parameters',
    ],
  },
  welcome: {
    name: 'Welcome & Goodbye',
    description: 'Greeting templates, departure logs, and custom banner image uploads.',
    commands: [
      '`/welcome toggle|set-channel|message|image-upload|preview|test`',
      '`/goodbye toggle|set-channel|message|preview|test`',
      'Supported placeholders: `{user}`, `{server}`, `{member_count}`',
    ],
  },
  reactionroles: {
    name: 'Reaction Roles',
    description: 'Button-based role assignment panels with multi-select and hierarchy checks.',
    commands: [
      '`/reaction-roles create <title> [desc] [multi_select]` - Deploy button panel',
      '`/reaction-roles add-role <panel_id> <role> <label> [style]` - Add role button',
      '`/reaction-roles remove-role <panel_id> <role>` - Remove role button',
      '`/reaction-roles delete <panel_id>` - Permanently delete panel',
    ],
  },
  leveling: {
    name: 'Leveling',
    description: 'Message XP accumulation, rank cards, leaderboards, and milestone roles.',
    commands: [
      '`/leveling-panel` - System configuration overview and reward tiers',
      '`/rank [user]` - View current XP level, progress bar, and server rank',
      '`/leaderboard [page]` - Paginated server experience rankings',
      '`/leveling config toggle|rate|cooldown` - Adjust leveling parameters',
      '`/leveling rewards add|remove|list` - Configure milestone role unlock rules',
    ],
  },
  giveaways: {
    name: 'Giveaways',
    description: 'Scheduled giveaways with entry buttons and restart-safe deadline recovery.',
    commands: [
      '`/giveaway start <duration> <winners> <prize> [channel]` - Launch giveaway',
      '`/giveaway end <message_id>` - Conclude giveaway immediately',
      '`/giveaway reroll <message_id> [count]` - Draw new winner from entry pool',
      '`/giveaway cancel <message_id>` - Abort giveaway without winners',
      '`/giveaway list` - List active giveaways in the server',
    ],
  },
  logging: {
    name: 'Audit Logging',
    description: 'Independent per-event dispatchers for compliance and security oversight.',
    commands: [
      '`/logging dashboard` - Full overview of active event dispatchers',
      '`/logging channel <target>` - Set primary audit channel',
      '`/logging toggle <event> <enabled>` - Toggle individual event categories',
      '`/logging status` - Quick summary of logging status',
    ],
  },
  utility: {
    name: 'Utility',
    description: 'Essential diagnostic, lookup, polling, and scheduling tools.',
    commands: [
      '`/help [category]` - Command documentation directory',
      '`/botinfo` - System specs, memory utilization, and runtime metrics',
      '`/serverinfo` - Server statistics, channel breakdown, and roles',
      '`/userinfo [user]` - Member profile, join date, and security data',
      '`/avatar [user]` - View and download full-resolution avatars',
      '`/ping` - Honest Gateway WebSocket vs REST API round-trip latency',
      '`/poll` - Interactive button-based voting with anti-duplicate guards',
      '`/remind set|list|cancel` - Persistent time-based reminders',
    ],
  },
  owner: {
    name: 'Owner Controls',
    description: 'Restricted administrative controls accessible only to the bot owner.',
    commands: [
      '`/owner-panel` - Global operations dashboard',
      '`/owner maintenance <enabled> [reason]` - Toggle maintenance mode',
      '`/owner allowlist add|remove|list` - Manage authorized server ID allowlist',
      '`/owner serverlist` - List all connected servers',
      '`/owner leaveserver <guild_id>` - Force exit from unauthorized guild',
      '`/owner shutdown` - Graceful application termination',
    ],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore Solas modules, slash commands, and configuration guides')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Specific module to inspect')
        .setRequired(false)
        .addChoices(
          { name: 'Moderation', value: 'moderation' },
          { name: 'Automod', value: 'automod' },
          { name: 'Tickets', value: 'tickets' },
          { name: 'Welcome & Goodbye', value: 'welcome' },
          { name: 'Reaction Roles', value: 'reactionroles' },
          { name: 'Leveling', value: 'leveling' },
          { name: 'Giveaways', value: 'giveaways' },
          { name: 'Audit Logging', value: 'logging' },
          { name: 'Utility', value: 'utility' },
          { name: 'Owner Controls', value: 'owner' }
        )
    ),

  async execute(interaction) {
    const categoryKey = interaction.options.getString('category');

    if (categoryKey && CATEGORIES[categoryKey]) {
      const cat = CATEGORIES[categoryKey];
      const embed = infoEmbed(`Documentation :: ${cat.name}`, cat.description);
      embed.addGlassField('Commands & Usage', cat.commands.join('\n'), false);
      return interaction.reply({ embeds: [embed] });
    }

    const embed = infoEmbed(
      'Solas Command Directory',
      'Solas is a private, high-performance Discord bot engineered with liquid-glass design principles, zero emojis, and SQLite WAL persistence.\n\nSpecify a `/help category` parameter for granular module details.'
    );

    for (const [key, cat] of Object.entries(CATEGORIES)) {
      embed.addGlassField(cat.name, `${cat.description}\n${cat.commands.length} commands available`, true);
    }

    return interaction.reply({ embeds: [embed] });
  },
};
