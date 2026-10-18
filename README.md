# Solas — Operations Core

Solas is a private, high-performance, modular Discord bot engineered with an electric-violet liquid-glass aesthetic, strict zero-emoji styling, and SQLite WAL persistence. Optimized for lean memory utilization on a 512 MB shared hosting environment, Solas operates as a single Node.js process managing an embedded, version-migrated SQLite database.

---

## Key Modules & Capabilities

1. **Moderation Operations**
   - Interactive `/moderation-panel` displaying real-time sanction logs, quick issue-warning modal, and panel refresh.
   - Destructive action confirmation prompts (`/ban`, `/kick`) with server-side author verification.
   - Safe unban by 17-20 digit Discord User ID (`/unban`).
   - Member communication timeouts (`/timeout`, `/untimeout`) with Discord 28-day boundary enforcement.
   - Persistent warnings system (`/warn`, `/warnings view`, `/warnings clear`, `/warnings remove`).
   - Channel rate limiting (`/slowmode`), channel lockdowns (`/lock`, `/unlock`), and `/nickname` control.
   - Filtered message purging (`/purge`) with bots, embeds, attachments, and user filters (respecting 14-day API restrictions).
   - Strict role hierarchy checks enforcing: Executor > Target, Bot > Target, and Owner Immunity.

2. **Automod Defense**
   - High-velocity flood and rapid spam detection via bounded in-memory sliding window ring buffers.
   - Mass-mention detection with configurable thresholds and automated timeout or deletion.
   - Configurable exemptions for Administrators, trusted roles, and designated channels.
   - Zero memory leaks: automated cleanup of stale user tracking buckets capped at 1,000 entries.

3. **Support Tickets**
   - Persistent `/ticket-panel` deployment with single-click channel generation.
   - Automated channel creation under designated categories with strict permission overwrites.
   - Claim, close, reopen, and participant management (`/ticket`).
   - Paginated message retrieval fetching full history (up to 5,000 messages) with rate-limit pacing.
   - Generation of dark violet liquid-glass HTML transcripts with safe HTML entity escaping (`escapeHtml`).
   - Clear transcript completeness reporting (`[COMPLETE ARCHIVE]` vs `[PARTIAL / INCOMPLETE]`) with message counts.
   - Automatic dispatch of transcript files to designated staff audit channels.

4. **Welcome & Departure Messaging**
   - Custom welcome (`/welcome`) and goodbye (`/goodbye`) templates with real-time config previews.
   - Variable substitution engine supporting `{user}`, `{server}`, and `{member_count}`.
   - Secure banner image uploads with MIME validation, 2MB file size limits, and path traversal protection.

5. **Button-Driven Reaction Roles**
   - Modern button-based role toggling (`/reaction-roles`) supporting multi-select or single-exclusive modes.
   - Live panel editing (add/remove buttons directly on deployed Discord messages).
   - Role hierarchy validation ensuring the bot cannot grant roles above its highest role.

6. **Leveling & Milestone Rewards**
   - Message XP accumulation with configurable rates and anti-spam cooldowns (`/leveling`).
   - Detailed rank cards (`/rank`) featuring liquid-glass ASCII progress bars.
   - Paginated server leaderboards (`/leaderboard`).
   - Idempotent milestone role assignment (`/leveling rewards`) with graceful permission recovery.

7. **Scheduled Giveaways**
   - Multi-winner giveaway engine (`/giveaway start`, `/giveaway end`, `/giveaway reroll`, `/giveaway cancel`).
   - Instant entry buttons with live entry counters and toggle-leave functionality.
   - Persistent deadlines stored in SQLite with 30-second periodic background sweeper and 32-bit timer overflow protection.
   - Concurrency-guarded atomic database resolution (`ended = 1`) preventing duplicate winners or announcements across restarts.

8. **Audit Logging**
   - Independent per-event toggles (`/logging dashboard`, `/logging toggle`) for message edits, deletions, joins, departures, role modifications, channel updates, moderation sanctions, and configuration changes.
   - Intent-aware logging: honestly reports when deleted message contents were not cached prior to deletion.

9. **Utility Tools**
   - Diagnostic `/ping` reporting honest WebSocket heartbeat versus REST API round-trip latency.
   - System specification inspect (`/botinfo`) showing heap utilization, uptime, Node version, and SQLite engine.
   - Server lookup (`/serverinfo`), user inspection (`/userinfo`), avatar extractor (`/avatar`), and interactive polls (`/poll`).
   - Persistent reminders (`/remind`) with deadline resumption, periodic sweeper, and atomic trigger flags.

10. **Owner & Security Controls**
    - Server-ID allowlist (`/owner allowlist`) restricting bot operations exclusively to authorized guilds.
    - Initial-setup state allowing the bot owner to safely bootstrap an empty allowlist without auto-ejection.
    - Global maintenance mode (`/owner maintenance`) locking out non-owner interactions without disabling owner controls.
    - Owner interactive dashboard (`/owner-panel`) with graceful process termination and server ejection (`/owner leaveserver`).
    - Honest module reload: in-memory hot reload for isolated modules (`commands`, `automod_cache`, `leveling_cooldowns`) and restart advisories for interconnected services.
    - Unified graceful shutdown closing Discord client, SQLite persistence, and timer sweepers.

---

## Technical Specifications & Architecture

- **Runtime**: Node.js (LTS v20+ or v24+)
- **Discord API**: `discord.js` v14
- **Database**: `better-sqlite3` running in WAL mode (`PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 5000`, `PRAGMA foreign_keys = ON`, `PRAGMA synchronous = NORMAL`)
- **Memory Footprint**: Target < 120 MB RSS under active load (designed for 512 MB shared containers)
- **Visual Design**: Electric Violet (`#7C3AED`), Slate Glass surfaces (`#1E1B4B`), divider rules, structured field sets, and **strictly zero emojis** across all messages, embeds, buttons, modals, and logs.
- **License**: MIT License

---

## Discord Developer Portal Setup

### 1. Application Creation
1. Navigate to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and enter `Solas`.
3. Under the **Bot** tab:
   - Click **Add Bot** or reset token to generate your `DISCORD_TOKEN`.
   - Disable **Public Bot** (since Solas is private to authorized servers).

### 2. Gateway Intents Configuration
Under the **Bot** tab in the Developer Portal, enable the following **Privileged Gateway Intents**:

- [x] **Server Members Intent (`GuildMembers`)**: Privileged. Required for tracking member join and departure events (welcome and goodbye dispatch, audit logging), fetching member objects for role hierarchy checks, assigning level reward roles and reaction roles, and checking guild membership.
- [x] **Message Content Intent (`MessageContent`)**: Privileged. Required for automod real-time message inspection (mass-mentions and spam/flood detection) and leveling XP calculation based on message activity.

> Note: **Presence Intent is NOT requested and must remain DISABLED**. Solas does not track member presences or activities.

Standard (non-privileged) intents requested by the client:
- `Guilds`: For guild caching, channel management, and role interactions.
- `GuildMessages`: For listening to message creation, edit, and deletion events.
- `GuildModeration`: For tracking audit log events and moderation actions.

### 3. Permissions Checklist
Under **OAuth2 > URL Generator**, select:
- **Scopes**: `bot`, `applications.commands`
- **Bot Permissions**:
  - `Manage Roles`
  - `Manage Channels`
  - `Kick Members`
  - `Ban Members`
  - `Moderate Members` (Timeouts)
  - `View Audit Log`
  - `View Channels`
  - `Send Messages`
  - `Manage Messages`
  - `Embed Links`
  - `Attach Files`
  - `Read Message History`
  - `Use External Emojis` (Unchecked — Solas strictly enforces zero emojis)

---

## Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DISCORD_TOKEN` | Discord Bot authentication token | `MTE...` |
| `DISCORD_CLIENT_ID` | Application Client ID snowflake | `123456789012345678` |
| `DISCORD_OWNER_ID` | Discord User ID of the bot owner | `987654321098765432` |
| `DISCORD_DEV_GUILD_ID` | Server ID for instant command registration during dev | `112233445566778899` |
| `DATA_DIRECTORY` | Base directory for persistent SQLite, transcripts, uploads | `./data` |
| `DATABASE_PATH` | Full filesystem path to the SQLite database file | `./data/solas.sqlite` |
| `LOG_LEVEL` | Minimum log verbosity level (`debug`, `info`, `warn`, `error`) | `info` |

---

## Allowlist Initial Setup Bootstrap Procedure

Solas enforces a strict server-ID allowlist. To avoid permanent lockouts on a fresh deployment:

1. **Initial Uninitialized Setup State**:
   - When the bot starts with an empty allowlist (`COUNT = 0`), it enters the Initial Setup State.
   - Connected guilds are **not** automatically left on startup or on join while the allowlist is empty.
   - All non-owner interactions are safely rejected with an ephemeral setup notice: `"Solas is in an initial uninitialized setup state. Only the configured bot owner can authorize this server using /owner allowlist add."`
2. **Owner Authorization**:
   - The configured bot owner (`DISCORD_OWNER_ID`) executes `/owner allowlist add <guild_id>`.
   - The server is recorded in SQLite with the owner ID, timestamp, and reason.
3. **Initialized State Enforcement**:
   - Once at least one server is authorized, the allowlist is fully active.
   - Any connected servers not in the allowlist are automatically left.
   - Any new server joined that is not in the allowlist is immediately rejected and left.
   - Regular member slash commands and button interactions are unlocked for authorized guilds.

---

## Deployment & Command Registration

### Local Setup
```bash
# Install dependencies
npm ci

# Run automated verification tests
npm test

# Deploy slash commands to development guild (instant registration)
npm run deploy:dev

# Or deploy slash commands globally (propagation up to 1 hour)
npm run deploy:global

# Launch Solas
npm start
```

---

## Container Deployment & Persistent Storage Guide

Solas is designed to run in a single lightweight Node.js container with low RAM usage (< 120 MB RSS), making it suitable for 512 MB shared hosting environments, Docker, or container platforms.

### Persistent Volume Requirement:
Because Solas uses an embedded SQLite database running in WAL mode, **ephemeral container filesystems will destroy bot data upon container restart, redeploy, or migration**.

- **Mount Point**: Ensure a persistent disk volume is mounted at the configured `DATA_DIRECTORY` (e.g. `/app/data`).
- **Data Preserved**:
  - SQLite database file (`solas.sqlite`, `solas.sqlite-wal`, `solas.sqlite-shm`)
  - Ticket HTML transcripts (`/app/data/transcripts/`)
  - Uploaded welcome banner images (`/app/data/welcome_assets/`)
  - Automatic database backups (`/app/data/backups/`)
- **Shared Host Note**: If deploying on shared container platforms (such as Quaxly, Railway, Fly.io, or VPS containers), verify that persistent volume storage is actively attached to your service before running in production.

---

## Backup & Maintenance

### Online Database Backup
Solas includes an online backup script using `better-sqlite3`'s native snapshot API, ensuring safe backups even while concurrent WAL transactions are executing:

```bash
npm run backup
```
Backups are archived in `${DATA_DIRECTORY}/backups/solas_backup_<timestamp>.sqlite`.

### Restoring from Backup
1. Stop the bot process (`kill <pid>` or stop container).
2. Replace `${DATABASE_PATH}` with the selected backup file.
3. Remove any stale `${DATABASE_PATH}-wal` and `${DATABASE_PATH}-shm` files.
4. Restart the bot. Versioned migrations will automatically check integrity without wiping data.

---

## Automated Verification Suite

Run the full offline test suite verifying all modules:

```bash
npm test
```

Tests validate:
- Server-ID allowlist verification, initial setup bootstrap, owner authorization, and auto-leave behavior
- Bot owner authentication and permission bitfield checks
- Full role hierarchy matrix (self, owner, bot, target, managed roles)
- Moderation warnings, unban validation, and action audit logs
- RPG leveling curves, progress calculations, and leaderboard offsets
- Level milestone rewards idempotency and missing permission resilience
- Giveaway deadline-based recovery, atomic end concurrency protection, and 32-bit timer overflow prevention
- Ticket creation, numbering, claim/close/reopen states, and HTML transcript generation
- Paginated message retrieval, rate-limit pacing, and transcript completeness reporting
- Safe HTML entity escaping preventing XSS injection
- Reminder scheduling, restart recovery, periodic sweeper, and atomic duplicate suppression
- Versioned database schema migrations
- Panel custom_id spoofing prevention and server-side authorization re-verification
- Automod spam sliding window and mass-mention detection
- Zero-emoji codebase compliance audit

---

## Troubleshooting Guide

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `Setup Required` on commands | Allowlist is empty; bot in setup state | Configured bot owner must run `/owner allowlist add <guild_id>`. |
| `Missing Access` on commands | Guild is not in the server allowlist | Run `/owner allowlist add <guild_id>` or verify `DISCORD_DEV_GUILD_ID` in `.env`. |
| `Interaction Failed` on panels | Actor does not hold requisite permissions | Solas rechecks server-side permissions on every button click. Ensure the user has the required Discord role/permission. |
| Cannot timeout/ban target | Discord Role Hierarchy violation | Ensure the Solas role is placed **above** the target user's highest role in Server Settings > Roles. |
| Deleted message content shows `[Not Cached]` | Message was sent before bot reboot | Discord does not provide historical message content for deleted uncached messages. Solas truthfully logs metadata rather than fabricating content. |
| Uploaded image rejected | File exceeds 2MB or invalid MIME | Ensure image is PNG, JPEG, WEBP, or GIF and under 2MB. |
| Maintenance mode lock | Maintenance mode enabled by owner | Use owner account to run `/owner maintenance false` or click toggle in `/owner-panel`. |

---

## License

This project is licensed under the [MIT License](LICENSE) — Copyright (c) 2026 VenZ9.
