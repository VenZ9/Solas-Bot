module.exports = {
  up(db) {
    db.exec(`
      -- Guild Allowlist (Owner controlled, verified at startup)
      CREATE TABLE IF NOT EXISTS guild_allowlist (
        guild_id TEXT PRIMARY KEY,
        added_at INTEGER NOT NULL,
        added_by TEXT NOT NULL,
        reason TEXT
      );

      -- Global Bot Metadata / Settings
      CREATE TABLE IF NOT EXISTS bot_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Guild Configuration
      CREATE TABLE IF NOT EXISTS guild_config (
        guild_id TEXT PRIMARY KEY,
        mod_log_channel TEXT,
        updated_at INTEGER NOT NULL
      );

      -- Moderation Warnings
      CREATE TABLE IF NOT EXISTS moderation_warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON moderation_warnings(guild_id, user_id);

      -- Moderation Actions Log
      CREATE TABLE IF NOT EXISTS moderation_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        reason TEXT,
        duration INTEGER,
        created_at INTEGER NOT NULL
      );

      -- Automod Configuration
      CREATE TABLE IF NOT EXISTS automod_config (
        guild_id TEXT PRIMARY KEY,
        mentions_enabled INTEGER DEFAULT 0,
        mention_threshold INTEGER DEFAULT 5,
        mention_action TEXT DEFAULT 'timeout',
        mention_duration INTEGER DEFAULT 300,
        spam_enabled INTEGER DEFAULT 0,
        spam_messages INTEGER DEFAULT 5,
        spam_seconds INTEGER DEFAULT 5,
        spam_action TEXT DEFAULT 'timeout',
        spam_duration INTEGER DEFAULT 300,
        exempt_roles TEXT DEFAULT '[]',
        exempt_channels TEXT DEFAULT '[]'
      );

      -- Ticket System Configuration
      CREATE TABLE IF NOT EXISTS ticket_config (
        guild_id TEXT PRIMARY KEY,
        category_id TEXT,
        staff_role_id TEXT,
        log_channel_id TEXT,
        ticket_counter INTEGER DEFAULT 0,
        panel_message_id TEXT
      );

      -- Tickets
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number INTEGER NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        claimed_by TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL,
        closed_at INTEGER,
        closed_by TEXT,
        close_reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id);

      -- Welcome / Goodbye Configuration
      CREATE TABLE IF NOT EXISTS welcome_config (
        guild_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 0,
        channel_id TEXT,
        message TEXT DEFAULT 'Welcome {user} to {server}! You are member #{member_count}.',
        image_path TEXT
      );

      CREATE TABLE IF NOT EXISTS goodbye_config (
        guild_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 0,
        channel_id TEXT,
        message TEXT DEFAULT 'Goodbye {user}. {server} now has {member_count} members.'
      );

      -- Reaction Roles
      CREATE TABLE IF NOT EXISTS reaction_role_panels (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        multi_select INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS reaction_role_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        panel_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        label TEXT NOT NULL,
        style TEXT DEFAULT 'Secondary',
        FOREIGN KEY (panel_id) REFERENCES reaction_role_panels(id) ON DELETE CASCADE
      );

      -- Leveling System
      CREATE TABLE IF NOT EXISTS leveling_config (
        guild_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        xp_rate REAL DEFAULT 1.0,
        cooldown_seconds INTEGER DEFAULT 60,
        exempt_channels TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS user_levels (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        last_xp_at INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_levels_rank ON user_levels(guild_id, xp DESC);

      CREATE TABLE IF NOT EXISTS level_rewards (
        guild_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, level)
      );

      -- Giveaways
      CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        prize TEXT NOT NULL,
        winner_count INTEGER NOT NULL DEFAULT 1,
        end_time INTEGER NOT NULL,
        ended INTEGER DEFAULT 0,
        winners TEXT DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_giveaways_active ON giveaways(guild_id, ended, end_time);

      CREATE TABLE IF NOT EXISTS giveaway_entries (
        giveaway_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        entered_at INTEGER NOT NULL,
        PRIMARY KEY (giveaway_id, user_id),
        FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
      );

      -- Logging Configuration
      CREATE TABLE IF NOT EXISTS logging_config (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT,
        log_edits INTEGER DEFAULT 0,
        log_deletes INTEGER DEFAULT 0,
        log_joins INTEGER DEFAULT 0,
        log_leaves INTEGER DEFAULT 0,
        log_roles INTEGER DEFAULT 0,
        log_channels INTEGER DEFAULT 0,
        log_mod INTEGER DEFAULT 0,
        log_tickets INTEGER DEFAULT 0,
        log_config INTEGER DEFAULT 0
      );

      -- Reminders
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        guild_id TEXT,
        message TEXT NOT NULL,
        trigger_at INTEGER NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(completed, trigger_at);
    `);
  },
};
