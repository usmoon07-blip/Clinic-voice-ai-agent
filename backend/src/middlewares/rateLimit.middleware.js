'use strict';
/** So'rovlar chekloviI: login, navbat yaratish, SMS va qo'ng'iroqlar uchun. */
const rateLimit = require('express-rate-limit');

const message = (code, text) => ({ success: false, error: { code, message: text } });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('TOO_MANY_LOGINS', 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.'),
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('TOO_MANY_BOOKINGS', 'Juda ko\'p so\'rov. Keyinroq urinib ko\'ring.'),
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('TOO_MANY_REQUESTS', 'Juda ko\'p so\'rov.'),
});

// Bitta raqamdan soatiga 10 tadan ortiq qo'ng'iroq — spam
const voiceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.From || req.body?.from || req.ip,
  message: message('TOO_MANY_CALLS', 'Juda ko\'p qo\'ng\'iroq.'),
});

module.exports = { loginLimiter, bookingLimiter, apiLimiter, voiceLimiter };
