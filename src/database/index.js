const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const { runMigrations } = require('./migrator');

let dbInstance = null;

function initDatabase(dbPath = config.databasePath) {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  logger.info(`Initializing SQLite database at: ${dbPath}`);
  const db = new Database(dbPath);

  // Configure high-performance and concurrency pragmas for 512MB shared host
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  // Run versioned migrations (does not wipe DB)
  runMigrations(db);

  dbInstance = db;
  return dbInstance;
}

function getDatabase() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

function closeDatabase() {
  if (dbInstance) {
    logger.info('Closing SQLite database connection.');
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
};
