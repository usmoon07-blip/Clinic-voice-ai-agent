'use strict';
/** Admin panel autentifikatsiyasi (JWT) va Telegram Mini App initData tekshiruvi. */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../database/connection');
const config = require('../config/default');
const logger = require('../utils/logger');

function sign(adminUser) {
  return jwt.sign(
    { id: adminUser.id, role: adminUser.role, doctorId: adminUser.doctorId || null },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn },
  );
}

/** Admin API uchun: Authorization: Bearer <token> */
async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'NO_TOKEN', message: 'Avtorizatsiya talab qilinadi' } });
  }
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    const admin = await prisma.adminUser.findUnique({ where: { id: payload.id } });
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, error: { code: 'INACTIVE', message: 'Foydalanuvchi faol emas' } });
    }
    req.admin = admin;
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, error: { code: 'BAD_TOKEN', message: 'Token yaroqsiz' } });
  }
}

/**
 * Telegram Mini App `initData` imzosini SERVER TOMONIDA tekshirish.
 * Bu bo'lmasa foydalanuvchi o'z Telegram ID sini soxtalashtirishi mumkin edi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (computed !== hash) return null;

  // 24 soatdan eski initData qabul qilinmaydi
  const authDate = Number(params.get('auth_date') || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) return null;

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

/**
 * Mini App so'rovlari uchun: `X-Telegram-Init-Data` sarlavhasi tekshiriladi.
 * Dev rejimda (`X-Dev-Telegram-Id`) qo'lda test qilishga ruxsat beriladi.
 */
async function attachTelegramUser(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  let tgUser = verifyTelegramInitData(initData, config.telegram.token);

  if (!tgUser && config.env === 'development' && req.headers['x-dev-telegram-id']) {
    tgUser = { id: Number(req.headers['x-dev-telegram-id']), first_name: 'Dev' };
    logger.warn('Dev rejimda Telegram ID sarlavhadan olindi');
  }

  if (!tgUser) {
    return res.status(401).json({
      success: false,
      error: { code: 'BAD_INIT_DATA', message: 'Telegram ma\'lumotlari tasdiqlanmadi' },
    });
  }

  req.telegramUser = tgUser;
  req.patient = await prisma.patient.findUnique({
    where: { telegramId: String(tgUser.id) },
    include: { familyMembers: true },
  });
  return next();
}

/** Bemor ro'yxatdan o'tgan bo'lishi shart bo'lgan endpointlar uchun. */
function requirePatient(req, res, next) {
  if (!req.patient) {
    return res.status(404).json({
      success: false,
      error: { code: 'PATIENT_NOT_REGISTERED', message: 'Avval profilni to\'ldiring' },
    });
  }
  return next();
}

module.exports = { sign, requireAdmin, attachTelegramUser, requirePatient, verifyTelegramInitData };
