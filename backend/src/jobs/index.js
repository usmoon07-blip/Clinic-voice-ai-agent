'use strict';
/** Barcha fon vazifalarini bitta interval bilan ishga tushirish. */
const config = require('../config/default');
const logger = require('../utils/logger');

const jobs = [
  require('./reminderJob'),
  require('./noShowJob'),
  require('./waitlistJob'),
  require('./feedbackJob'),
  require('./retentionJob'),
];

let timer = null;

async function tick() {
  for (const job of jobs) {
    // eslint-disable-next-line no-await-in-loop
    await job.run();
  }
}

function start() {
  if (!config.jobs.enabled) {
    logger.info('Fon vazifalari o\'chirilgan (ENABLE_JOBS=false)');
    return;
  }
  logger.info(`Fon vazifalari ishga tushdi (har ${config.jobs.intervalMs / 1000} soniyada)`);
  timer = setInterval(() => {
    tick().catch((e) => logger.error('Job tick xatosi', { message: e.message }));
  }, config.jobs.intervalMs);
  timer.unref?.();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, tick };
