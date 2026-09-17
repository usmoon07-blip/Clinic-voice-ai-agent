'use strict';
/**
 * Eslatmalar: 24 soat oldin, tayyorgarlik yo'riqnomasi, 2 soat oldin,
 * shifokorga kunlik ro'yxat.
 * Har bir eslatma uchun alohida timestamp bor — job qayta ishga tushsa ham
 * xabar IKKI MARTA yuborilmaydi.
 */
const { prisma } = require('../database/connection');
const notificationService = require('../services/notificationService');
const messages = require('../config/messages');
const config = require('../config/default');
const time = require('../utils/time');
const logger = require('../utils/logger');

const ACTIVE = ['PENDING', 'CONFIRMED'];

function windowAround(hoursAhead, toleranceMinutes = 45) {
  const target = Date.now() + hoursAhead * 3600000;
  return {
    gte: new Date(target - toleranceMinutes * 60000),
    lte: new Date(target + toleranceMinutes * 60000),
  };
}

/** 24 soatlik eslatma + "Tasdiqlash / Bekor qilish" tugmalari. */
async function sendDayBeforeReminders() {
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ACTIVE },
      dayBeforeReminderSentAt: null,
      startTime: windowAround(24),
    },
    include: { patient: true, doctor: true, service: true },
    take: 100,
  });

  for (const appt of appointments) {
    const lang = appt.patient.language || 'UZ';
    const text = messages.dayBeforeReminder({
      appointment: appt, doctor: appt.doctor, service: appt.service, patient: appt.patient, lang,
    });
    const keyboard = {
      reply_markup: {
        inline_keyboard: [[
          { text: lang === 'RU' ? '✅ Подтверждаю' : '✅ Tasdiqlayman', callback_data: `confirm:${appt.id}` },
          { text: lang === 'RU' ? '❌ Отменить' : '❌ Bekor qilish', callback_data: `cancel:${appt.id}` },
        ]],
      },
    };
    await notificationService.notifyPatient(appt.patient, {
      telegramText: text, smsText: text, options: keyboard,
    });
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { dayBeforeReminderSentAt: new Date() },
    });
  }
  return appointments.length;
}

/** Tayyorgarlik yo'riqnomasi (xizmatning `prepReminderHours` iga qarab). */
async function sendPreparationInstructions() {
  const candidates = await prisma.appointment.findMany({
    where: {
      status: { in: ACTIVE },
      prepInstructionSentAt: null,
      startTime: { gte: new Date(), lte: new Date(Date.now() + 48 * 3600000) },
    },
    include: { patient: true, service: true },
    take: 100,
  });

  let sent = 0;
  for (const appt of candidates) {
    const text = messages.preparationInstruction({
      service: appt.service, lang: appt.patient.language || 'UZ',
    });
    if (!text) {
      await prisma.appointment.update({ where: { id: appt.id }, data: { prepInstructionSentAt: new Date() } });
      continue;
    }
    const hoursLeft = (new Date(appt.startTime).getTime() - Date.now()) / 3600000;
    if (hoursLeft > (appt.service.prepReminderHours || 24)) continue;

    await notificationService.notifyPatient(appt.patient, { telegramText: text, smsText: text.slice(0, 300) });
    await prisma.appointment.update({ where: { id: appt.id }, data: { prepInstructionSentAt: new Date() } });
    sent += 1;
  }
  return sent;
}

/** 2 soatlik eslatma. */
async function sendHourBeforeReminders() {
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ACTIVE },
      hourBeforeReminderSentAt: null,
      startTime: windowAround(2, 20),
    },
    include: { patient: true, room: true },
    take: 100,
  });

  for (const appt of appointments) {
    const text = messages.hourBeforeReminder({
      appointment: appt, room: appt.room, lang: appt.patient.language || 'UZ',
    });
    await notificationService.notifyPatient(appt.patient, { telegramText: text, smsText: text });
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { hourBeforeReminderSentAt: new Date() },
    });
  }
  return appointments.length;
}

/** Ish kuni boshida shifokorga kunlik ro'yxat (08:00 Toshkent). */
let agendaSentForDate = null;
async function sendDoctorAgendas() {
  const nowTashkent = time.now();
  if (nowTashkent.hour !== 8) return 0;
  const todayKey = nowTashkent.toFormat('yyyy-MM-dd');
  if (agendaSentForDate === todayKey) return 0;

  const doctors = await prisma.doctor.findMany({
    where: { isActive: true, telegramId: { not: null } },
  });

  for (const doctor of doctors) {
    const appts = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        startTime: { gte: time.startOfDayUtc(todayKey), lt: time.endOfDayUtc(todayKey) },
        status: { in: ACTIVE },
      },
      include: { patient: true, service: true },
      orderBy: { startTime: 'asc' },
    });
    if (appts.length === 0) continue;

    const items = appts.map(
      (a) => `${time.timeKey(a.startTime)} — ${a.patient.firstName} ${a.patient.lastName || ''} (${a.service.nameUz})`,
    );
    await notificationService.notifyDoctor(
      doctor,
      messages.doctorDailyAgenda({ count: appts.length, items, lang: 'UZ' }),
    );
  }
  agendaSentForDate = todayKey;
  return doctors.length;
}

async function run() {
  try {
    const [dayBefore, prep, hourBefore] = await Promise.all([
      sendDayBeforeReminders(),
      sendPreparationInstructions(),
      sendHourBeforeReminders(),
    ]);
    await sendDoctorAgendas();
    if (dayBefore || prep || hourBefore) {
      logger.info('Eslatmalar yuborildi', { dayBefore, prep, hourBefore });
    }
  } catch (e) {
    logger.error('reminderJob xatosi', { message: e.message });
  }
}

module.exports = {
  run,
  sendDayBeforeReminders,
  sendPreparationInstructions,
  sendHourBeforeReminders,
  sendDoctorAgendas,
  config,
};
