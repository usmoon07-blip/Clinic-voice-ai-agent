'use strict';
/** Klinika AI Voice Agent — backend kirish nuqtasi. */
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/default');
const { connect, disconnect } = require('./database/connection');
const { errorHandler, notFound } = require('./middlewares/error.middleware');
const { apiLimiter } = require('./middlewares/rateLimit.middleware');
const clientRoutes = require('./routes/client.routes');
const adminRoutes = require('./routes/admin.routes');
const voiceRoutes = require('./routes/voice.routes');
const bot = require('./core/bot');
const jobs = require('./jobs');
const logger = require('./utils/logger');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.cors.origins.includes(origin) || config.env === 'development') return cb(null, true);
    return cb(new Error('CORS: ruxsat yo\'q'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
// Twilio webhooklari form-urlencoded yuboradi
app.use(express.urlencoded({ extended: false }));

// Salomlashuv audiosi va TTS fayllari
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() }, error: null });
});

app.use('/api/client', apiLimiter, clientRoutes);
app.use('/api/admin', adminRoutes);
// Voice webhooklariga umumiy limit qo'llanmaydi — o'z limiti bor
app.use('/api/voice', voiceRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connect();
  bot.start();
  jobs.start();

  const server = app.listen(config.port, () => {
    logger.info(`Backend ishga tushdi: http://localhost:${config.port}`);
    logger.info(`Ommaviy manzil (webhook uchun): ${config.publicUrl}`);
    if (!config.ai.apiKey) logger.warn('ANTHROPIC_API_KEY yo\'q — Voice Agent AI rejimi ishlamaydi (DTMF zaxira rejimi ishlaydi)');
  });

  // Tarmoq xatolari (Telegram/telefoniya) butun serverni yiqitmasin
  const NETWORK_ERRORS = ['ECONNRESET', 'EFATAL', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'];
  process.on('uncaughtException', (err) => {
    if (NETWORK_ERRORS.includes(err.code) || /EFATAL|ECONNRESET/.test(err.message || '')) {
      logger.error('Tarmoq xatosi (server ishlashda davom etadi)', { message: err.message, code: err.code });
      return;
    }
    logger.error('Kutilmagan xato — server to\'xtatilmoqda', { message: err.message, stack: err.stack });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Ushlanmagan promise rad etishi', { message: reason?.message || String(reason) });
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} — to'xtatilmoqda...`);
    jobs.stop();
    server.close();
    await disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  start().catch((e) => {
    logger.error('Ishga tushirib bo\'lmadi', { message: e.message });
    process.exit(1);
  });
}

module.exports = { app, start };
