const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function runMigrations(db) {
  // Ensure schema migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js') || f.endsWith('.sql'))
    .sort();

  const newlyApplied = [];

  for (const file of files) {
    const match = file.match(/^(\d+)_(.*)\.(js|sql)$/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    const name = match[2];

    if (!appliedVersions.has(version)) {
      logger.info(`Applying database migration [${version}]: ${name}`);
      const filePath = path.join(migrationsDir, file);

      const runTx = db.transaction(() => {
        if (file.endsWith('.js')) {
          const migration = require(filePath);
          migration.up(db);
        } else if (file.endsWith('.sql')) {
          const sql = fs.readFileSync(filePath, 'utf8');
          db.exec(sql);
        }

        db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(version, name, Date.now());
      });

      runTx();
      newlyApplied.push({ version, name });
    }
  }

  if (newlyApplied.length > 0) {
    logger.info(`Database schema up to date. Applied ${newlyApplied.length} new migration(s).`);
  }

  return newlyApplied;
}

module.exports = {
  runMigrations,
};
