'use strict';
require('dotenv').config();

const toInt = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const toBool = (v, d = false) => (v === undefined ? d : String(v).toLowerCase() === 'true');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 4000),
  timezone: process.env.TZ || 'Asia/Tashkent',
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:4000',

  cors: {
    origins: [
      process.env.MINIAPP_ORIGIN || 'http://localhost:5173',
      process.env.ADMIN_PANEL_ORIGIN || 'http://localhost:5174',
    ],
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
    superadminLogin: process.env.SUPERADMIN_LOGIN || 'admin',
    superadminPassword: process.env.SUPERADMIN_PASSWORD || 'admin12345',
  },

  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    miniAppUrl: process.env.MINIAPP_URL || '',
    usePolling: toBool(process.env.TELEGRAM_USE_POLLING, true),
  },

  telephony: {
    provider: process.env.TELEPHONY_PROVIDER || 'twilio',
    operatorPhone: process.env.OPERATOR_PHONE_NUMBER || '',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      validateSignature: toBool(process.env.TWILIO_VALIDATE_SIGNATURE, false),
    },
    sip: {
      ariUrl: process.env.SIP_ARI_URL || 'http://127.0.0.1:8088',
      ariUser: process.env.SIP_ARI_USER || 'asterisk',
      ariPassword: process.env.SIP_ARI_PASSWORD || '',
      ariApp: process.env.SIP_ARI_APP || 'clinic-voice',
      operatorExtension: process.env.SIP_OPERATOR_EXTENSION || '100',
    },
  },

  sms: {
    provider: process.env.SMS_PROVIDER || 'none',
    eskiz: {
      email: process.env.ESKIZ_EMAIL || '',
      password: process.env.ESKIZ_PASSWORD || '',
      from: process.env.ESKIZ_FROM || '4546',
    },
  },

  speech: {
    sttProvider: process.env.STT_PROVIDER || 'google',
    sttLanguage: process.env.STT_LANGUAGE || 'uz-UZ',
    sttAlternatives: (process.env.STT_ALTERNATIVE_LANGUAGES || 'ru-RU').split(',').filter(Boolean),
    ttsProvider: process.env.TTS_PROVIDER || 'twilio',
    elevenLabsKey: process.env.ELEVENLABS_API_KEY || '',
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '',
    yandexKey: process.env.YANDEX_API_KEY || '',
    deepgramKey: process.env.DEEPGRAM_API_KEY || '',
    greetingAudioUz: process.env.GREETING_AUDIO_URL_UZ || '/audio/greeting-uz.mp3',
    greetingAudioRu: process.env.GREETING_AUDIO_URL_RU || '/audio/greeting-ru.mp3',
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-sonnet-5',
    maxTokens: toInt(process.env.AI_MAX_TOKENS, 400),
    // 2 marta tushunmasa operatorga uzatiladi
    maxMisunderstandings: 2,
    // Javob shu vaqtdan cho'zilsa "bir soniya..." to'ldiruvchisi qo'yiladi
    thinkingFillerMs: 1200,
  },

  booking: {
    cancellationWindowMinutes: toInt(process.env.CANCELLATION_WINDOW_MINUTES, 120),
    minLeadTimeMinutes: toInt(process.env.MIN_LEAD_TIME_MINUTES, 30),
    bufferMinutes: toInt(process.env.APPOINTMENT_BUFFER_MINUTES, 5),
    noShowThreshold: toInt(process.env.NO_SHOW_THRESHOLD, 3),
    recordingRetentionDays: toInt(process.env.RECORDING_RETENTION_DAYS, 90),
    // Bo'sh vaqt qidirishda oldinga necha kun qaraladi
    searchHorizonDays: 30,
    // Kutish ro'yxati taklifi necha daqiqa amal qiladi
    waitlistOfferMinutes: 30,
  },

  clinic: {
    name: process.env.CLINIC_NAME || 'Klinika',
    phone: process.env.CLINIC_PHONE || '',
    address: process.env.CLINIC_ADDRESS || '',
    latitude: Number(process.env.CLINIC_LATITUDE) || null,
    longitude: Number(process.env.CLINIC_LONGITUDE) || null,
    emergencyPhone: process.env.EMERGENCY_PHONE || '103',
  },

  jobs: {
    enabled: toBool(process.env.ENABLE_JOBS, true),
    intervalMs: toInt(process.env.JOB_INTERVAL_MS, 120000),
  },
};
