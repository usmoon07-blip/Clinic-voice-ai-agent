'use strict';
/**
 * Bekor qilish / ko'chirish oynasi qoidasi.
 * Bitta joyda yoziladi va Mini App, Admin panel, AI Voice Agent — hammasi shuni chaqiradi.
 * Frontend tekshiruvini aylanib o'tib bo'lmasligi uchun backend mustaqil tekshiradi.
 */
const settingsService = require('./settingsService');
const time = require('../utils/time');

/**
 * @param {Object} appointment  { startTime, status }
 * @param {Object} options
 * @param {'PATIENT'|'ADMIN'|'DOCTOR'|'SYSTEM'} options.actor
 * @returns {Promise<{allowed: boolean, reason?: string, minutesLeft: number, windowMinutes: number}>}
 */
async function canCancel(appointment, { actor = 'PATIENT' } = {}) {
  const settings = await settingsService.getSettings();
  const windowMinutes = settings.cancellationWindowMinutes ?? 120;
  const minutesLeft = Math.floor(
    (new Date(appointment.startTime).getTime() - Date.now()) / 60000,
  );

  if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
    return { allowed: false, reason: 'ALREADY_CLOSED', minutesLeft, windowMinutes };
  }

  // Admin va shifokor istalgan vaqtda bekor qila oladi — cheklov faqat bemorga
  if (actor === 'ADMIN' || actor === 'DOCTOR' || actor === 'SYSTEM') {
    return { allowed: true, minutesLeft, windowMinutes };
  }

  if (minutesLeft < 0) {
    return { allowed: false, reason: 'ALREADY_STARTED', minutesLeft, windowMinutes };
  }
  if (minutesLeft < windowMinutes) {
    return { allowed: false, reason: 'WINDOW_PASSED', minutesLeft, windowMinutes };
  }
  return { allowed: true, minutesLeft, windowMinutes };
}

/** Ko'chirish ham xuddi shu qoidaga bo'ysunadi. */
async function canReschedule(appointment, options) {
  return canCancel(appointment, options);
}

/** Foydalanuvchiga ko'rsatiladigan matn. */
function explain(result, lang = 'UZ') {
  const hours = Math.round((result.windowMinutes / 60) * 10) / 10;
  const texts = {
    WINDOW_PASSED: {
      UZ: `Bekor qilish muddati o'tdi (qabulgacha ${hours} soatdan kam qoldi). Iltimos, klinikaga qo'ng'iroq qiling.`,
      RU: `Срок отмены истёк (до приёма осталось менее ${hours} ч). Пожалуйста, позвоните в клинику.`,
    },
    ALREADY_STARTED: {
      UZ: 'Qabul vaqti allaqachon boshlangan.',
      RU: 'Время приёма уже началось.',
    },
    ALREADY_CLOSED: {
      UZ: 'Bu navbat allaqachon yopilgan.',
      RU: 'Эта запись уже закрыта.',
    },
  };
  return texts[result.reason]?.[lang] || (lang === 'RU' ? 'Действие недоступно.' : 'Amal bajarib bo\'lmaydi.');
}

module.exports = { canCancel, canReschedule, explain, timeUtil: time };
