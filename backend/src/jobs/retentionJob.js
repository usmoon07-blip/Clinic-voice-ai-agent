'use strict';
/**
 * Maxfiylik: qo'ng'iroq yozuvlari va transkriptlar saqlash muddati tugagach
 * avtomatik o'chiriladi (SiteSetting.recordingRetentionDays).
 */
const { prisma } = require('../database/connection');
const settingsService = require('../services/settingsService');
const logger = require('../utils/logger');

let lastRunDate = null;

async function run() {
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    if (lastRunDate === todayKey) return 0; // kuniga bir marta yetarli
    lastRunDate = todayKey;

    const settings = await settingsService.getSettings();
    const cutoff = new Date(Date.now() - (settings.recordingRetentionDays ?? 90) * 86400000);

    const result = await prisma.callLog.updateMany({
      where: { startedAt: { lt: cutoff }, OR: [{ transcript: { not: null } }, { recordingUrl: { not: null } }] },
      data: { transcript: null, recordingUrl: null },
    });

    if (result.count) logger.info('Eski qo\'ng\'iroq yozuvlari tozalandi', { count: result.count });
    return result.count;
  } catch (e) {
    logger.error('retentionJob xatosi', { message: e.message });
    return 0;
  }
}

module.exports = { run };
