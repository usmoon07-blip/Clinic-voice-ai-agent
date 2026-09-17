'use strict';
/** Yagona xato formati: { success, data, error: { code, message } } */
const logger = require('../utils/logger');

const HTTP_BY_CODE = {
  BAD_PHONE: 400,
  VALIDATION: 400,
  AGE_NOT_ALLOWED: 400,
  NOT_A_COURSE: 400,
  SLOT_TAKEN: 409,
  DOCTOR_BUSY: 409,
  NO_ROOM: 409,
  WINDOW_PASSED: 409,
  ALREADY_STARTED: 409,
  ALREADY_CLOSED: 409,
  WRONG_STATUS: 409,
  BLACKLISTED: 403,
  NO_SHOW_LIMIT: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PATIENT_NOT_FOUND: 404,
  DOCTOR_NOT_FOUND: 404,
  SERVICE_NOT_FOUND: 404,
  GUARDIAN_NOT_FOUND: 404,
};

const MESSAGES_UZ = {
  SLOT_TAKEN: 'Bu vaqt hozirgina band bo\'ldi. Iltimos, boshqa vaqtni tanlang.',
  DOCTOR_BUSY: 'Shifokor bu vaqtda band.',
  NO_ROOM: 'Bu vaqtda mos kabinet bo\'sh emas.',
  CALENDAR_CLOSED: 'Shifokorning kalendari vaqtincha yopiq.',
  OUTSIDE_WORKING_HOURS: 'Bu vaqt ish vaqtidan tashqarida.',
  TOO_LATE: 'Bu vaqtga yozilish uchun kech. Boshqa vaqtni tanlang.',
  AGE_NOT_ALLOWED: 'Bu xizmat bemorning yoshiga mos emas.',
  NO_SHOW_LIMIT: 'Onlayn navbat cheklangan. Iltimos, registraturaga qo\'ng\'iroq qiling.',
  BLACKLISTED: 'Onlayn navbat cheklangan. Iltimos, registraturaga qo\'ng\'iroq qiling.',
};

function notFound(req, res) {
  res.status(404).json({
    success: false,
    data: null,
    error: { code: 'ROUTE_NOT_FOUND', message: 'Manzil topilmadi' },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const code = err.code || 'INTERNAL';
  const status = HTTP_BY_CODE[code] || (code === 'INTERNAL' ? 500 : 400);

  if (status >= 500) {
    logger.error('So\'rov xatosi', { path: req.originalUrl, message: err.message, stack: err.stack });
  } else {
    logger.warn('So\'rov rad etildi', { path: req.originalUrl, code });
  }

  res.status(status).json({
    success: false,
    data: null,
    error: {
      code,
      message: MESSAGES_UZ[code] || err.message || 'Xatolik yuz berdi',
      ...(err.policy ? { policy: err.policy } : {}),
    },
  });
}

/** async controllerlarni o'rash. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, notFound, asyncHandler };
