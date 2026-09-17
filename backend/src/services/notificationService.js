'use strict';
/**
 * Bildirishnomalar: Telegram (bo'lsa) yoki SMS (bo'lmasa) + shifokorga xabar.
 * Har bir navbat manbasidan qat'i nazar shu servis chaqiriladi.
 */
const { prisma } = require('../database/connection');
const messages = require('../config/messages');
const smsService = require('./smsService');
const settingsService = require('./settingsService');
const config = require('../config/default');
const logger = require('../utils/logger');

// bot.js ishga tushganda o'zini shu yerga ro'yxatdan o'tkazadi (aylanma importdan qochish uchun)
let botSender = null;
function registerBot(sender) {
  botSender = sender;
}

async function sendTelegram(chatId, text, options) {
  if (!botSender || !chatId) return false;
  try {
    await botSender(chatId, text, options);
    return true;
  } catch (e) {
    logger.error('Telegram xabari yuborilmadi', { chatId, message: e.message });
    return false;
  }
}

/** Bemorga: avval Telegram, bo'lmasa SMS. */
async function notifyPatient(patient, { telegramText, smsText, options }) {
  if (patient.notificationsConsent === false) return { channel: 'none' };

  if (patient.telegramId) {
    const ok = await sendTelegram(patient.telegramId, telegramText, options);
    if (ok) return { channel: 'telegram' };
  }
  if (smsText) {
    const res = await smsService.send(patient.phone, smsText);
    if (res.sent) return { channel: 'sms' };
  }
  return { channel: 'none' };
}

async function notifyDoctor(doctor, text) {
  if (!doctor?.telegramId) return { channel: 'none' };
  const ok = await sendTelegram(doctor.telegramId, text);
  return { channel: ok ? 'telegram' : 'none' };
}

/** To'liq bog'lanishlari bilan navbatni yuklash. */
async function loadAppointment(appointmentId) {
  return prisma.appointment.findUnique({
    where: { id: Number(appointmentId) },
    include: { patient: true, doctor: true, service: true, room: true },
  });
}

/** Navbat yaratilgandan keyin: bemorga tasdiq + shifokorga xabar + tayyorgarlik. */
async function onAppointmentCreated(appointmentId) {
  const appt = await loadAppointment(appointmentId);
  if (!appt) return;
  const settings = await settingsService.getSettings();
  const lang = appt.patient.language || 'UZ';

  const telegramText = messages.bookingConfirmed({
    appointment: appt,
    doctor: appt.doctor,
    service: appt.service,
    room: appt.room,
    patient: appt.patient,
    lang,
  });
  const smsText = messages.bookingConfirmedSms({
    appointment: appt,
    doctor: appt.doctor,
    room: appt.room,
    clinicName: settings.clinicName,
    lang,
  });

  const keyboard = config.telegram.miniAppUrl
    ? {
        reply_markup: {
          inline_keyboard: [[
            {
              text: lang === 'RU' ? '📅 Мои записи' : '📅 Mening navbatlarim',
              web_app: { url: `${config.telegram.miniAppUrl}/appointments` },
            },
          ]],
        },
      }
    : undefined;

  await notifyPatient(appt.patient, { telegramText, smsText, options: keyboard });

  // Tayyorgarlik yo'riqnomasi darhol ham yuboriladi (qabulgacha vaqt kam bo'lishi mumkin)
  const prep = messages.preparationInstruction({ service: appt.service, lang });
  if (prep) {
    await notifyPatient(appt.patient, { telegramText: prep, smsText: prep.slice(0, 300) });
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { prepInstructionSentAt: new Date() },
    });
  }

  await notifyDoctor(
    appt.doctor,
    messages.newBookingForDoctor({
      appointment: appt,
      patient: appt.patient,
      service: appt.service,
      lang: 'UZ',
    }),
  );
}

/** Navbat bekor qilinganda. */
async function onAppointmentCancelled(appointmentId, { byClinic = false } = {}) {
  const appt = await loadAppointment(appointmentId);
  if (!appt) return;
  const lang = appt.patient.language || 'UZ';

  const text = byClinic
    ? messages.cancelledByClinic({ appointment: appt, doctor: appt.doctor, lang })
    : messages.cancelledByPatient({ appointment: appt, lang });

  await notifyPatient(appt.patient, { telegramText: text, smsText: text });

  if (!byClinic) {
    await notifyDoctor(
      appt.doctor,
      `❌ Navbat bekor qilindi: ${appt.patient.firstName}, ${require('../utils/time').formatDateHuman(appt.startTime)} ${require('../utils/time').timeKey(appt.startTime)}`,
    );
  }
}

/** Bemor "Yo'ldaman" tugmasini bosganda. */
async function onPatientOnTheWay(appointmentId) {
  const appt = await loadAppointment(appointmentId);
  if (!appt) return;
  await notifyDoctor(
    appt.doctor,
    messages.onTheWay({ patient: appt.patient, appointment: appt, lang: 'UZ' }),
  );
}

module.exports = {
  registerBot,
  sendTelegram,
  notifyPatient,
  notifyDoctor,
  onAppointmentCreated,
  onAppointmentCancelled,
  onPatientOnTheWay,
  loadAppointment,
};
