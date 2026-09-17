'use strict';
/**
 * Qo'ng'iroqda bemor shaxsini tasdiqlash.
 *
 * Caller ID soxtalashtirilishi mumkin. Shuning uchun MAVJUD navbat ma'lumotini
 * aytish, ko'chirish yoki bekor qilishdan oldin qo'shimcha bitta fakt so'raladi:
 * familiya yoki tug'ilgan yil. Yangi navbat olish uchun bu talab qilinmaydi.
 */
const { prisma } = require('../database/connection');
const phoneUtil = require('../utils/phone');
const time = require('../utils/time');
const triage = require('./triageService');

function normalizeName(value) {
  return triage
    .normalize(value)
    .replace(/[^a-zа-яё' ]/gi, '')
    .trim();
}

/** Ikki ism yetarlicha o'xshashmi? (STT xatolariga chidamli) */
function namesMatch(input, stored) {
  const a = normalizeName(input);
  const b = normalizeName(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Birinchi 4 harf mos kelsa (STT ismlarni buzib yozishi mumkin)
  return a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4);
}

/**
 * @param {Object} p
 * @param {string} p.phone
 * @param {string} [p.nameOrBirthYear]  "Karimov" yoki "1990"
 * @returns {Promise<{verified: boolean, patient?: Object, reason?: string}>}
 */
async function verify({ phone, nameOrBirthYear }) {
  const normalized = phoneUtil.normalize(phone);
  if (!normalized) return { verified: false, reason: 'BAD_PHONE' };

  const patient = await prisma.patient.findUnique({ where: { phone: normalized } });
  if (!patient) return { verified: false, reason: 'PATIENT_NOT_FOUND' };
  if (!nameOrBirthYear) return { verified: false, reason: 'ANSWER_REQUIRED', patient: null };

  const answer = String(nameOrBirthYear).trim();

  // Tug'ilgan yil
  const yearMatch = answer.match(/(19|20)\d{2}/);
  if (yearMatch && patient.birthDate) {
    const storedYear = time.toTashkent(patient.birthDate).year;
    if (Number(yearMatch[0]) === storedYear) return { verified: true, patient };
  }

  // Familiya yoki ism
  if (namesMatch(answer, patient.lastName) || namesMatch(answer, patient.firstName)) {
    return { verified: true, patient };
  }

  return { verified: false, reason: 'MISMATCH' };
}

/** Telefon raqami bo'yicha bemorni topish (tasdiqlashsiz — faqat mavjudligini bilish uchun). */
async function findByPhone(phone) {
  const normalized = phoneUtil.normalize(phone);
  if (!normalized) return null;
  return prisma.patient.findUnique({
    where: { phone: normalized },
    include: { familyMembers: true },
  });
}

/** Kartochka raqamini generatsiya qilish: MC-2026-000123 */
async function generateCardNumber() {
  const year = time.now().year;
  const count = await prisma.patient.count();
  return `MC-${year}-${String(count + 1).padStart(6, '0')}`;
}

module.exports = { verify, findByPhone, generateCardNumber, namesMatch };
