/**
 * Solas Bot - System Constants
 * Strictly zero emojis. Polished violet liquid-glass aesthetics.
 */

module.exports = {
  // Brand & Colors
  COLORS: {
    PRIMARY: 0x7C3AED,      // Vivid Electric Violet
    SECONDARY: 0x4C1D95,    // Deep Glass Violet
    ACCENT: 0x8B5CF6,       // Muted Glass Violet
    SURFACE: 0x1E1B4B,      // Midnight Violet Surface
    SUCCESS: 0x10B981,      // Emerald Success
    WARNING: 0xF59E0B,      // Amber Warning
    ERROR: 0xEF4444,        // Crimson Error
    INFO: 0x6366F1,         // Indigo Info
    NEUTRAL: 0x64748B,      // Slate Glass Neutral
  },

  // Visual layout framing elements
  DIVIDER: '────────────────────────────────────────',
  DIVIDER_SHORT: '──────────────────────',

  // System Headers & Badges (Clean monospace brackets, NO emojis)
  TAGS: {
    SYSTEM: '[SYSTEM]',
    SECURITY: '[SECURITY]',
    SUCCESS: '[SUCCESS]',
    ERROR: '[ERROR]',
    WARNING: '[WARNING]',
    AUDIT: '[AUDIT]',
    CONFIRM: '[CONFIRMATION REQUIRED]',
    MAINTENANCE: '[MAINTENANCE MODE]',
    TICKET: '[TICKET]',
    GIVEAWAY: '[GIVEAWAY]',
    AUTOMOD: '[AUTOMOD]',
    LOG: '[LOG]',
  },

  // Default limits and thresholds for 512MB memory profile
  LIMITS: {
    MAX_PURGE: 100,
    MAX_GIVEAWAY_WINNERS: 20,
    MAX_IMAGE_UPLOAD_BYTES: 2 * 1024 * 1024, // 2MB
    ALLOWED_IMAGE_MIMES: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    AUTOMOD_CACHE_MAX_USERS: 1000,
    AUTOMOD_CACHE_TTL_MS: 30000, // 30s sliding window
    XP_COOLDOWN_DEFAULT_SEC: 60,
  },

  // Supported logging events
  LOG_EVENTS: [
    'edits',
    'deletes',
    'joins',
    'leaves',
    'roles',
    'channels',
    'mod_actions',
    'tickets',
    'config',
  ],

  // Footer branding
  FOOTER_TEXT: 'SOLAS :: Modular Operations Core',
};
