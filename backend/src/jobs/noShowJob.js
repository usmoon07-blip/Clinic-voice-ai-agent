'use strict';
/** Qabul vaqtidan 30 daqiqa o'tib hali kelmagan bemorni "Kelmadi" deb belgilash. */
const { prisma } = require('../database/connection');
const logger = require('../utils/logger');

const GRACE_MINUTES = 30;

async function run() {
  try {
    const threshold = new Date(Date.now() - GRACE_MINUTES * 60000);
    const stale = await prisma.appointment.findMany({
      where: { status: { in: ['PENDING', 'CONFIRMED'] }, startTime: { lt: threshold } },
      take: 200,
    });

    for (const appt of stale) {
      await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'NO_SHOW' } });
      await prisma.patient.update({
        where: { id: appt.patientId },
        data: { noShowCount: { increment: 1 } },
      });
    }
    if (stale.length) logger.info('Kelmaganlar belgilandi', { count: stale.length });
    return stale.length;
  } catch (e) {
    logger.error('noShowJob xatosi', { message: e.message });
    return 0;
  }
}

module.exports = { run, GRACE_MINUTES };
