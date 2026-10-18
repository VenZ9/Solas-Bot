const config = require('../config');

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LEVELS[config.logLevel] !== undefined ? LEVELS[config.logLevel] : 1;

function sanitize(data) {
  if (typeof data === 'string') {
    if (config.token && config.token.length > 5) {
      data = data.replaceAll(config.token, '[REDACTED_DISCORD_TOKEN]');
    }
    return data;
  }
  if (data instanceof Error) {
    let msg = data.stack || data.message;
    if (config.token && config.token.length > 5) {
      msg = msg.replaceAll(config.token, '[REDACTED_DISCORD_TOKEN]');
    }
    return msg;
  }
  if (typeof data === 'object' && data !== null) {
    try {
      const json = JSON.stringify(data);
      if (config.token && config.token.length > 5) {
        return json.replaceAll(config.token, '[REDACTED_DISCORD_TOKEN]');
      }
      return json;
    } catch {
      return String(data);
    }
  }
  return data;
}

function formatPrefix(levelName) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${levelName.toUpperCase()}]`;
}

module.exports = {
  debug(...args) {
    if (currentLevel <= LEVELS.debug) {
      console.log(formatPrefix('debug'), ...args.map(sanitize));
    }
  },
  info(...args) {
    if (currentLevel <= LEVELS.info) {
      console.log(formatPrefix('info'), ...args.map(sanitize));
    }
  },
  warn(...args) {
    if (currentLevel <= LEVELS.warn) {
      console.warn(formatPrefix('warn'), ...args.map(sanitize));
    }
  },
  error(...args) {
    if (currentLevel <= LEVELS.error) {
      console.error(formatPrefix('error'), ...args.map(sanitize));
    }
  },
};
