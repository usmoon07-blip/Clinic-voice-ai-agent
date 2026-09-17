'use strict';
/** Kutish ro'yxati: muddati o'tgan takliflarni bo'shatish va yangi joylarni taklif qilish. */
const waitlistService = require('../services/waitlistService');
const logger = require('../utils/logger');

async function run() {
  try {
    const expired = await waitlistService.expireOffers();
    const offered = await waitlistService.scanForOpenings({ limit: 20 });
    if (expired || offered) logger.info('Kutish ro\'yxati', { expired, offered });
  } catch (e) {
    logger.error('waitlistJob xatosi', { message: e.message });
  }
}

module.exports = { run };
