'use strict';
/** Oddiy logger. Shaxsiy ma'lumotlar (telefon, tug'ilgan sana) maskalanadi. */
const phone = require('./phone');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

/** Matndagi telefon raqamlari va sanalarni maskalash. */
function sanitize(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\+?\d{9,15}/g, (m) => phone.mask(m))
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '****-**-**');
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (['phone', 'birthDate', 'passwordHash', 'password', 'token'].includes(k)) {
        out[k] = k === 'phone' ? phone.mask(v) : '***';
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  return value;
}

function log(level, message, meta) {
  if (LEVELS[level] > CURRENT) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${sanitize(message)}`;
  if (meta !== undefined) {
    console[level === 'debug' ? 'log' : level](line, JSON.stringify(sanitize(meta)));
  } else {
    console[level === 'debug' ? 'log' : level](line);
  }
}

module.exports = {
  error: (m, meta) => log('error', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  info: (m, meta) => log('info', m, meta),
  debug: (m, meta) => log('debug', m, meta),
  sanitize,
};
