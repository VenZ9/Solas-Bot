const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runMigrations } = require('../src/database/migrator');

test('Database Migrations Engine', async (t) => {
  await t.test('applies migrations cleanly on fresh database', () => {
    const db = new Database(':memory:');
    const applied = runMigrations(db);

    assert.ok(applied.length > 0, 'Should apply at least initial migration');
    assert.equal(applied[0].version, 1);

    // Verify tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert.ok(tables.includes('schema_migrations'), 'schema_migrations table must exist');
    assert.ok(tables.includes('guild_allowlist'), 'guild_allowlist table must exist');
    assert.ok(tables.includes('moderation_warnings'), 'moderation_warnings table must exist');
    assert.ok(tables.includes('tickets'), 'tickets table must exist');
    assert.ok(tables.includes('giveaways'), 'giveaways table must exist');
    assert.ok(tables.includes('reminders'), 'reminders table must exist');
    assert.ok(tables.includes('user_levels'), 'user_levels table must exist');

    db.close();
  });

  await t.test('subsequent migration runs are idempotent and do not wipe existing data', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    // Insert dummy record
    db.prepare("INSERT INTO guild_allowlist (guild_id, added_at, added_by, reason) VALUES ('123456789012345678', 1000, 'owner', 'test')").run();

    // Re-run migrations
    const newlyApplied = runMigrations(db);
    assert.equal(newlyApplied.length, 0, 'No new migrations should be applied');

    // Verify existing record is intact
    const row = db.prepare("SELECT * FROM guild_allowlist WHERE guild_id = '123456789012345678'").get();
    assert.ok(row, 'Data must not be wiped on subsequent startup');
    assert.equal(row.guild_id, '123456789012345678');

    db.close();
  });
});
