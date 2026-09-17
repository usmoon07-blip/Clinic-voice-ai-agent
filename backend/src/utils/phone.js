'use strict';
/** Telefon raqamlarini yagona +998XXXXXXXXX formatiga keltirish. */

/**
 * Qabul qiladi: "901234567", "90 123 45 67", "+998901234567",
 * "998901234567", "8 90 123 45 67" -> "+998901234567"
 */
function normalize(input) {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, '');

  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  // Mahalliy "8" prefiksi bilan yozilgan raqam
  if (digits.startsWith('8') && digits.length === 10) return `+998${digits.slice(1)}`;
  if (digits.startsWith('00998')) return `+${digits.slice(2)}`;
  // Xalqaro raqam (test uchun Twilio raqamlari)
  if (digits.length > 9 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** To'g'ri o'zbek raqamimi? */
function isValid(input) {
  const n = normalize(input);
  return Boolean(n) && /^\+\d{10,15}$/.test(n);
}

/** Loglar va transkriptlar uchun: "+998 90 *** ** 67" */
function mask(input) {
  const n = normalize(input);
  if (!n) return '***';
  const tail = n.slice(-2);
  const head = n.slice(0, 7);
  return `${head} *** ** ${tail}`;
}

/** Ovozda o'qish uchun: "90 123 45 67" */
function speakable(input) {
  const n = normalize(input);
  if (!n) return '';
  const local = n.startsWith('+998') ? n.slice(4) : n.slice(1);
  return local.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
}

module.exports = { normalize, isValid, mask, speakable };
