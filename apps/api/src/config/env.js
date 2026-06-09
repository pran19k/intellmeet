function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required in .env`);
  }
  return value;
}

function parseDurationToSeconds(value, fallbackSeconds) {
  if (!value) return fallbackSeconds;

  const match = String(value).trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    throw new Error(`Invalid duration value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 }[unit];
  return amount * multiplier;
}

const ACCESS_TOKEN_SECRET = requireEnv('JWT_SECRET');
const REFRESH_TOKEN_SECRET = requireEnv('JWT_REFRESH_SECRET');
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = parseDurationToSeconds(process.env.JWT_EXPIRES_IN, 15 * 60);
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = parseDurationToSeconds(process.env.REFRESH_TOKEN_EXPIRES_IN, 7 * 24 * 60 * 60);

module.exports = {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  REFRESH_TOKEN_EXPIRES_IN_SECONDS,
};
