'use strict';
/**
 * Telegram bot: menyu, Mini App tugmasi va bildirishnomalar kanali.
 * Narxlar Voice Agent va Admin panel bilan BITTA bazadan olinadi.
 */
const TelegramBot = require('node-telegram-bot-api');
const { prisma } = require('../database/connection');
const notificationService = require('../services/notificationService');
const bookingService = require('../services/bookingService');
const settingsService = require('../services/settingsService');
const config = require('../config/default');
const time = require('../utils/time');
const logger = require('../utils/logger');

let bot = null;

const T = {
  UZ: {
    welcome: (clinic) => `Assalomu alaykum! 🏥 ${clinic} ga xush kelibsiz.\n\nQuyidagi tugmalar orqali navbat olishingiz mumkin.`,
    book: '🩺 Navbat olish',
    services: '💊 Xizmatlar va narxlar',
    doctors: '👨‍⚕️ Shifokorlar',
    myAppointments: '📅 Mening navbatlarim',
    profile: '👤 Profil',
    location: '📍 Manzil',
    call: '📞 Qo\'ng\'iroq qilish',
    language: '🌐 Til / Язык',
    callInfo: (phone) => `📞 ${phone}\n\nAI yordamchimiz 24/7 javob beradi — qo'ng'iroq qilib ham navbat olishingiz mumkin.`,
    noAppointments: 'Sizda hozircha navbat yo\'q.',
    servicesHeader: '💊 Xizmatlar va narxlar:',
    doctorsHeader: '👨‍⚕️ Shifokorlarimiz:',
    languageChanged: 'Til o\'zgartirildi ✅',
    confirmed: 'Rahmat! Navbatingiz tasdiqlandi ✅',
    cancelled: 'Navbat bekor qilindi.',
    cancelFailed: (msg) => `Bekor qilib bo'lmadi: ${msg}`,
    thanksRating: 'Bahoyingiz uchun rahmat! ⭐',
    notRegistered: 'Avval Mini App orqali profilingizni to\'ldiring.',
  },
  RU: {
    welcome: (clinic) => `Здравствуйте! 🏥 Добро пожаловать в ${clinic}.\n\nЗаписаться можно через кнопки ниже.`,
    book: '🩺 Записаться',
    services: '💊 Услуги и цены',
    doctors: '👨‍⚕️ Врачи',
    myAppointments: '📅 Мои записи',
    profile: '👤 Профиль',
    location: '📍 Адрес',
    call: '📞 Позвонить',
    language: '🌐 Til / Язык',
    callInfo: (phone) => `📞 ${phone}\n\nНаш AI-помощник отвечает круглосуточно — записаться можно и по телефону.`,
    noAppointments: 'У вас пока нет записей.',
    servicesHeader: '💊 Услуги и цены:',
    doctorsHeader: '👨‍⚕️ Наши врачи:',
    languageChanged: 'Язык изменён ✅',
    confirmed: 'Спасибо! Запись подтверждена ✅',
    cancelled: 'Запись отменена.',
    cancelFailed: (msg) => `Не удалось отменить: ${msg}`,
    thanksRating: 'Спасибо за оценку! ⭐',
    notRegistered: 'Сначала заполните профиль в Mini App.',
  },
};

async function langFor(telegramId) {
  const patient = await prisma.patient.findUnique({ where: { telegramId: String(telegramId) } });
  return patient?.language || 'UZ';
}

function mainKeyboard(lang) {
  const t = T[lang];
  const rows = [
    [config.telegram.miniAppUrl
      ? { text: t.book, web_app: { url: config.telegram.miniAppUrl } }
      : { text: t.book }],
    [{ text: t.services }, { text: t.doctors }],
    [{ text: t.myAppointments }, { text: t.profile }],
    [{ text: t.location }, { text: t.call }],
    [{ text: t.language }],
  ];
  return { reply_markup: { keyboard: rows, resize_keyboard: true } };
}

async function sendServices(chatId, lang) {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: { specialty: true },
    orderBy: [{ specialtyId: 'asc' }, { nameUz: 'asc' }],
  });

  const bySpecialty = {};
  for (const s of services) {
    const key = lang === 'RU' ? s.specialty.nameRu : s.specialty.nameUz;
    (bySpecialty[key] = bySpecialty[key] || []).push(s);
  }

  const lines = [T[lang].servicesHeader, ''];
  for (const [specialty, items] of Object.entries(bySpecialty)) {
    lines.push(`*${specialty}*`);
    for (const s of items) {
      const name = lang === 'RU' ? s.nameRu : s.nameUz;
      const price = Number(s.price).toLocaleString('ru-RU');
      lines.push(`  • ${name} — ${price} ${lang === 'RU' ? 'сум' : 'so\'m'} (${s.durationMinutes} ${lang === 'RU' ? 'мин' : 'daq'})`);
    }
    lines.push('');
  }
  await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

async function sendDoctors(chatId, lang) {
  const doctors = await prisma.doctor.findMany({
    where: { isActive: true },
    include: { specialty: true },
    orderBy: { experienceYears: 'desc' },
  });
  const lines = [T[lang].doctorsHeader, ''];
  for (const d of doctors) {
    const specialty = lang === 'RU' ? d.specialty.nameRu : d.specialty.nameUz;
    const closed = d.calendarStatus === 'CLOSED' ? (lang === 'RU' ? ' (временно не принимает)' : ' (vaqtincha qabul qilmaydi)') : '';
    lines.push(`*${d.firstName} ${d.lastName}* — ${specialty}${closed}`);
    lines.push(`  ${d.experienceYears} ${lang === 'RU' ? 'лет опыта' : 'yil tajriba'}${d.category ? `, ${d.category}` : ''}`);
    lines.push('');
  }
  await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
}

async function sendMyAppointments(chatId, lang) {
  const patient = await prisma.patient.findUnique({ where: { telegramId: String(chatId) } });
  if (!patient) return bot.sendMessage(chatId, T[lang].notRegistered);

  const family = await prisma.patient.findMany({ where: { guardianId: patient.id }, select: { id: true } });
  const ids = [patient.id, ...family.map((f) => f.id)];

  const appointments = await prisma.appointment.findMany({
    where: { patientId: { in: ids }, startTime: { gte: new Date() }, status: { in: ['PENDING', 'CONFIRMED'] } },
    include: { doctor: true, service: true, room: true, patient: true },
    orderBy: { startTime: 'asc' },
    take: 10,
  });

  if (appointments.length === 0) return bot.sendMessage(chatId, T[lang].noAppointments);

  for (const a of appointments) {
    const svc = a.service.isSensitive || patient.discreetMode
      ? null
      : (lang === 'RU' ? a.service.nameRu : a.service.nameUz);
    const lines = [
      `📅 ${time.formatDateHuman(a.startTime, lang)}, ${time.timeKey(a.startTime)}`,
      `👨‍⚕️ ${a.doctor.firstName} ${a.doctor.lastName}`,
      svc ? `🩺 ${svc}` : null,
      a.room ? `🚪 ${a.room.name}` : null,
      a.patientId !== patient.id ? `👤 ${a.patient.firstName}` : null,
    ].filter(Boolean);

    await bot.sendMessage(chatId, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[
          { text: lang === 'RU' ? '❌ Отменить' : '❌ Bekor qilish', callback_data: `cancel:${a.id}` },
        ]],
      },
    });
  }
  return null;
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const lang = await langFor(chatId);
  const [action, id, extra] = String(query.data || '').split(':');

  try {
    if (action === 'confirm') {
      await prisma.appointment.update({
        where: { id: Number(id) },
        data: { status: 'CONFIRMED', patientConfirmedAt: new Date() },
      });
      await bot.answerCallbackQuery(query.id, { text: T[lang].confirmed });
      await bot.sendMessage(chatId, T[lang].confirmed);
      return;
    }

    if (action === 'cancel') {
      await bookingService.cancelAppointment({
        appointmentId: Number(id),
        actor: 'PATIENT',
        reason: 'Telegram orqali bekor qilindi',
      });
      await bot.answerCallbackQuery(query.id, { text: T[lang].cancelled });
      await bot.sendMessage(chatId, T[lang].cancelled);
      return;
    }

    if (action === 'rate') {
      const appointment = await prisma.appointment.findUnique({ where: { id: Number(id) } });
      if (appointment) {
        await prisma.review.upsert({
          where: { appointmentId: appointment.id },
          update: { rating: Number(extra) },
          create: { appointmentId: appointment.id, patientId: appointment.patientId, rating: Number(extra) },
        });
      }
      await bot.answerCallbackQuery(query.id, { text: T[lang].thanksRating });
      return;
    }

    if (action === 'lang') {
      await prisma.patient.updateMany({
        where: { telegramId: String(chatId) },
        data: { language: extra || id },
      });
      const newLang = (extra || id) === 'RU' ? 'RU' : 'UZ';
      await bot.answerCallbackQuery(query.id, { text: T[newLang].languageChanged });
      await bot.sendMessage(chatId, T[newLang].languageChanged, mainKeyboard(newLang));
      return;
    }

    await bot.answerCallbackQuery(query.id);
  } catch (e) {
    await bot.answerCallbackQuery(query.id, { text: T[lang].cancelFailed(e.message).slice(0, 190) });
    logger.error('Bot callback xatosi', { message: e.message });
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const lang = await langFor(chatId);
  const t = T[lang];
  const settings = await settingsService.getSettings();

  if (text.startsWith('/start')) {
    return bot.sendMessage(chatId, t.welcome(settings.clinicName), mainKeyboard(lang));
  }
  if (text === T.UZ.services || text === T.RU.services) return sendServices(chatId, lang);
  if (text === T.UZ.doctors || text === T.RU.doctors) return sendDoctors(chatId, lang);
  if (text === T.UZ.myAppointments || text === T.RU.myAppointments) return sendMyAppointments(chatId, lang);
  if (text === T.UZ.call || text === T.RU.call) {
    return bot.sendMessage(chatId, t.callInfo(settings.phone));
  }
  if (text === T.UZ.location || text === T.RU.location) {
    if (settings.latitude && settings.longitude) {
      await bot.sendLocation(chatId, settings.latitude, settings.longitude);
    }
    return bot.sendMessage(chatId, `📍 ${settings.address}${settings.landmark ? `\n(${settings.landmark})` : ''}`);
  }
  if (text === T.UZ.language) {
    return bot.sendMessage(chatId, 'Tilni tanlang / Выберите язык:', {
      reply_markup: {
        inline_keyboard: [[
          { text: "🇺🇿 O'zbekcha", callback_data: 'lang:UZ' },
          { text: '🇷🇺 Русский', callback_data: 'lang:RU' },
        ]],
      },
    });
  }
  if (text === T.UZ.profile || text === T.RU.profile) {
    const patient = await prisma.patient.findUnique({ where: { telegramId: String(chatId) } });
    if (!patient) return bot.sendMessage(chatId, t.notRegistered);
    const lines = [
      `👤 ${patient.firstName} ${patient.lastName || ''}`,
      `📞 ${patient.phone}`,
      `🆔 ${patient.medicalCardNumber}`,
    ];
    return bot.sendMessage(chatId, lines.join('\n'));
  }

  return bot.sendMessage(chatId, t.welcome(settings.clinicName), mainKeyboard(lang));
}

const TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]{30,}$/;

function start() {
  if (!config.telegram.token) {
    logger.warn('TELEGRAM_BOT_TOKEN sozlanmagan — bot ishga tushmadi');
    return null;
  }
  if (!TOKEN_PATTERN.test(config.telegram.token)) {
    logger.warn('TELEGRAM_BOT_TOKEN formati noto\'g\'ri (BotFather bergan tokenni qo\'ying) — bot ishga tushmadi');
    return null;
  }

  bot = new TelegramBot(config.telegram.token, { polling: config.telegram.usePolling });

  bot.on('message', (msg) => {
    handleMessage(msg).catch((e) => logger.error('Bot xabar xatosi', { message: e.message }));
  });
  bot.on('callback_query', (q) => {
    handleCallback(q).catch((e) => logger.error('Bot callback xatosi', { message: e.message }));
  });
  // Tarmoq uzilishi botni ham, serverni ham yiqitmasligi kerak
  bot.on('polling_error', (e) => logger.error('Telegram polling xatosi', { message: e.message }));
  bot.on('webhook_error', (e) => logger.error('Telegram webhook xatosi', { message: e.message }));
  bot.on('error', (e) => logger.error('Telegram bot xatosi', { message: e.message }));

  // notificationService shu bot orqali xabar yuboradi
  notificationService.registerBot((chatId, text, options) =>
    bot.sendMessage(chatId, text, options || {}));

  logger.info('Telegram bot ishga tushdi');
  return bot;
}

function getBot() {
  return bot;
}

module.exports = { start, getBot, mainKeyboard, T };
