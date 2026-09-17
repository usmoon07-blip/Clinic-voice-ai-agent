'use strict';
/** Qabuldan 2 soat keyin bemordan baho so'rash. */
const { prisma } = require('../database/connection');
const notificationService = require('../services/notificationService');
const messages = require('../config/messages');
const logger = require('../utils/logger');

async function run() {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        status: 'COMPLETED',
        feedbackRequestedAt: null,
        endTime: { lte: new Date(Date.now() - 2 * 3600000), gte: new Date(Date.now() - 48 * 3600000) },
      },
      include: { patient: true, doctor: true },
      take: 50,
    });

    for (const appt of appointments) {
      if (!appt.patient.telegramId) {
        await prisma.appointment.update({ where: { id: appt.id }, data: { feedbackRequestedAt: new Date() } });
        continue;
      }
      const lang = appt.patient.language || 'UZ';
      const stars = [1, 2, 3, 4, 5].map((n) => ({ text: '⭐'.repeat(n), callback_data: `rate:${appt.id}:${n}` }));
      await notificationService.notifyPatient(appt.patient, {
        telegramText: messages.feedbackRequest({ doctor: appt.doctor, lang }),
        smsText: null,
        options: { reply_markup: { inline_keyboard: [stars.slice(0, 3), stars.slice(3)] } },
      });
      await prisma.appointment.update({ where: { id: appt.id }, data: { feedbackRequestedAt: new Date() } });
    }
    if (appointments.length) logger.info('Baho so\'rovlari yuborildi', { count: appointments.length });
  } catch (e) {
    logger.error('feedbackJob xatosi', { message: e.message });
  }
}

module.exports = { run };
