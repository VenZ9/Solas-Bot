const path = require('path');
const fs = require('fs');
const config = require('../src/config');
const { getDatabase, initDatabase } = require('../src/database');
const logger = require('../src/utils/logger');

async function backup() {
  const db = initDatabase(config.databasePath);
  const backupDir = path.join(config.dataDirectory, 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `solas_backup_${timestamp}.sqlite`);

  logger.info(`Starting online WAL SQLite backup to: ${backupFile}`);

  try {
    await db.backup(backupFile);
    logger.info(`Backup completed successfully (${fs.statSync(backupFile).size} bytes).`);
  } catch (err) {
    logger.error(`Database backup failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  backup();
}

module.exports = { backup };
