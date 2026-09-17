'use strict';
/**
 * Vaqt bilan ishlash. QOIDA: bazada hamma vaqt UTC da saqlanadi,
 * foydalanuvchiga ko'rsatishda Asia/Tashkent ga o'giriladi.
 */
const { DateTime } = require('luxon');

const ZONE = process.env.TZ || 'Asia/Tashkent';

/** Hozirgi vaqt (Toshkent). */
function now() {
  return DateTime.now().setZone(ZONE);
}

/** "2026-09-18" + "09:30" (Toshkent) -> UTC JS Date */
function toUtc(dateStr, timeStr = '00:00') {
  const dt = DateTime.fromFormat(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', { zone: ZONE });
  if (!dt.isValid) throw new Error(`Noto'g'ri sana/vaqt: ${dateStr} ${timeStr}`);
  return dt.toUTC().toJSDate();
}

/** UTC Date -> Toshkent DateTime */
function toTashkent(date) {
  return DateTime.fromJSDate(date instanceof Date ? date : new Date(date)).setZone(ZONE);
}

/** UTC Date -> "2026-09-18" (Toshkent kuni) */
function dateKey(date) {
  return toTashkent(date).toFormat('yyyy-MM-dd');
}

/** UTC Date -> "09:30" (Toshkent) */
function timeKey(date) {
  return toTashkent(date).toFormat('HH:mm');
}

/** Toshkent kuni boshlanishi -> UTC Date */
function startOfDayUtc(dateStr) {
  return toUtc(dateStr, '00:00');
}

/** Toshkent kuni oxiri (keyingi kun 00:00) -> UTC Date */
function endOfDayUtc(dateStr) {
  return DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone: ZONE })
    .plus({ days: 1 })
    .toUTC()
    .toJSDate();
}

/** ISO hafta kuni: 1 = dushanba ... 7 = yakshanba */
function isoDayOfWeek(dateStr) {
  return DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone: ZONE }).weekday;
}

/** "09:30" -> 570 (yarim tundan boshlab daqiqa) */
function hhmmToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30" */
function minutesToHhmm(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Bugundan boshlab N kunlik sana ro'yxati: ["2026-09-18", ...] */
function dateRange(fromStr, days) {
  const start = DateTime.fromFormat(fromStr, 'yyyy-MM-dd', { zone: ZONE });
  return Array.from({ length: days }, (_, i) => start.plus({ days: i }).toFormat('yyyy-MM-dd'));
}

const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul',
  'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
  'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS_UZ = ['dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba'];
const WEEKDAYS_RU = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

/** "18-sentyabr, payshanba" / "18 сентября, четверг" */
function formatDateHuman(date, lang = 'UZ') {
  const dt = toTashkent(date);
  if (lang === 'RU') {
    return `${dt.day} ${MONTHS_RU[dt.month - 1]}, ${WEEKDAYS_RU[dt.weekday - 1]}`;
  }
  return `${dt.day}-${MONTHS_UZ[dt.month - 1]}, ${WEEKDAYS_UZ[dt.weekday - 1]}`;
}

/** Og'zaki sanani ("ertaga", "завтра", "dushanba") ISO sanaga o'girish. */
function parseSpokenDate(text, base = now()) {
  if (!text) return null;
  const t = String(text).toLowerCase().trim();

  // Allaqachon ISO formatda bo'lsa
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return t;

  const relative = {
    bugun: 0, сегодня: 0,
    ertaga: 1, завтра: 1,
    indinga: 2, послезавтра: 2, 'ertadan keyin': 2,
  };
  for (const [word, offset] of Object.entries(relative)) {
    if (t.includes(word)) return base.plus({ days: offset }).toFormat('yyyy-MM-dd');
  }

  // Hafta kuni nomi -> eng yaqin kelasi shu kun
  const weekdays = [...WEEKDAYS_UZ, ...WEEKDAYS_RU];
  for (let i = 0; i < weekdays.length; i++) {
    if (t.includes(weekdays[i])) {
      const target = (i % 7) + 1;
      let d = base;
      for (let k = 0; k < 8; k++) {
        d = d.plus({ days: 1 });
        if (d.weekday === target) return d.toFormat('yyyy-MM-dd');
      }
    }
  }
  return null;
}

/** Og'zaki vaqtni ("to'qqiz yarim", "пол-одиннадцатого", "9:30") "HH:mm" ga o'girish. */
function parseSpokenTime(text) {
  if (!text) return null;
  const t = String(text).toLowerCase().trim();

  const hhmm = t.match(/(\d{1,2})[:.\s](\d{2})/);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    if (h < 24 && m < 60) return minutesToHhmm(h * 60 + m);
  }

  const numbersUz = {
    'bir': 1, 'ikki': 2, 'uch': 3, "to'rt": 4, 'tort': 4, 'besh': 5, 'olti': 6,
    'yetti': 7, 'sakkiz': 8, "to'qqiz": 9, 'toqqiz': 9, "o'n": 10, 'on': 10,
    "o'n bir": 11, 'on bir': 11, "o'n ikki": 12, 'on ikki': 12,
  };

  // "to'qqiz yarim" = 9:30
  for (const [word, value] of Object.entries(numbersUz)) {
    if (t.startsWith(word) || t.includes(`${word} yarim`)) {
      const half = t.includes('yarim');
      let hour = value;
      if (t.includes('kechqurun') || t.includes('kechki')) hour = hour < 12 ? hour + 12 : hour;
      return minutesToHhmm(hour * 60 + (half ? 30 : 0));
    }
  }

  // Ruscha "пол-одиннадцатого" = 10:30 (o'n birga yarim kam)
  const ruHalf = t.match(/пол[-\s]?(\p{L}+)/u);
  if (ruHalf) {
    const ordinals = ['перв', 'втор', 'трет', 'четверт', 'пят', 'шест', 'седьм',
      'восьм', 'девят', 'десят', 'одиннадцат', 'двенадцат'];
    const idx = ordinals.findIndex((o) => ruHalf[1].startsWith(o));
    if (idx >= 0) return minutesToHhmm(idx * 60 + 30);
  }

  const bare = t.match(/^(\d{1,2})$/);
  if (bare) {
    const h = Number(bare[1]);
    if (h < 24) return minutesToHhmm(h * 60);
  }
  return null;
}

module.exports = {
  ZONE,
  now,
  toUtc,
  toTashkent,
  dateKey,
  timeKey,
  startOfDayUtc,
  endOfDayUtc,
  isoDayOfWeek,
  hhmmToMinutes,
  minutesToHhmm,
  dateRange,
  formatDateHuman,
  parseSpokenDate,
  parseSpokenTime,
};
