const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DATA_DIRECTORY = path.resolve(process.env.DATA_DIRECTORY || './data');
const DATABASE_PATH = path.resolve(process.env.DATABASE_PATH || path.join(DATA_DIRECTORY, 'solas.sqlite'));
const TRANSCRIPTS_DIR = path.join(DATA_DIRECTORY, 'transcripts');
const UPLOADS_DIR = path.join(DATA_DIRECTORY, 'uploads');
const WELCOME_ASSETS_DIR = path.join(DATA_DIRECTORY, 'welcome_assets');

// Ensure persistent storage directories exist
for (const dir of [DATA_DIRECTORY, TRANSCRIPTS_DIR, UPLOADS_DIR, WELCOME_ASSETS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  ownerId: process.env.DISCORD_OWNER_ID || '',
  devGuildId: process.env.DISCORD_DEV_GUILD_ID || '',
  databasePath: DATABASE_PATH,
  dataDirectory: DATA_DIRECTORY,
  transcriptsDir: TRANSCRIPTS_DIR,
  uploadsDir: UPLOADS_DIR,
  welcomeAssetsDir: WELCOME_ASSETS_DIR,
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),

  validate() {
    const missing = [];
    if (!this.token) missing.push('DISCORD_TOKEN');
    if (!this.clientId) missing.push('DISCORD_CLIENT_ID');
    if (!this.ownerId) missing.push('DISCORD_OWNER_ID');

    if (missing.length > 0) {
      throw new Error(`[CONFIG ERROR] Missing required environment variables: ${missing.join(', ')}`);
    }
  },
};
