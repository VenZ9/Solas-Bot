function parseDuration(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();

  const match = trimmed.match(/^(\d+)\s*(s|m|h|d|w)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (isNaN(value) || value <= 0) return null;

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  const calculated = value * multipliers[unit];
  const MAX_DURATION_MS = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years upper limit

  if (!Number.isFinite(calculated) || calculated <= 0 || calculated > MAX_DURATION_MS) {
    return null;
  }

  return calculated;
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

module.exports = {
  parseDuration,
  formatDuration,
};
