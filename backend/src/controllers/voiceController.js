'use strict';
/**
 * Voice Agent webhooklari.
 *
 * Oqim:
 *   POST /api/voice/incoming  -> 3 soniya ichida javob + oldindan yozilgan salomlashuv
 *   POST /api/voice/collect   -> STT natijasi kelади -> AI javobi -> yana tinglash
 *   POST /api/voice/dtmf      -> AI ishlamaganda raqamli menyu
 *   POST /api/voice/status    -> qo'ng'iroq tugadi -> CallLog yakunlanadi
 */
const { prisma } = require('../database/connection');
const voiceAgent = require('../core/voiceAgent');
const ttsService = require('../services/ttsService');
const settingsService = require('../services/settingsService');
const availability = require('../services/availabilityService');
const bookingService = require('../services/bookingService');
const { getProvider } = require('../telephony');
const { STATIC } = require('../config/voicePrompt');
const config = require('../config/default');
const logger = require('../utils/logger');
const time = require('../utils/time');

const provider = () => getProvider();

function send(res, xmlOrJson) {
  res.set('Content-Type', provider().contentType);
  return res.send(xmlOrJson);
}

function url(pathname, params = {}) {
  const query = new URLSearchParams(params).toString();
  return `${config.publicUrl}/api/voice/${pathname}${query ? `?${query}` : ''}`;
}

function sttLanguageFor(session) {
  return session?.language === 'RU' ? 'ru-RU' : config.speech.sttLanguage;
}

/** Twilio (yoki SIP) so'rovidan qo'ng'iroq ma'lumotini olish. */
function callInfo(req) {
  const body = req.body || {};
  return {
    callSid: body.CallSid || body.callId || body.callSid || `local-${Date.now()}`,
    from: body.From || body.from || body.caller || null,
    speech: body.SpeechResult || body.speech || body.transcript || '',
    digits: body.Digits || body.digits || '',
    duration: Number(body.CallDuration || body.duration || 0) || null,
    status: body.CallStatus || body.status || null,
  };
}

/** 1) Kiruvchi qo'ng'iroq — 3 soniya ichida javob. */
async function incoming(req, res) {
  const info = callInfo(req);
  logger.info('Kiruvchi qo\'ng\'iroq', { callSid: info.callSid });

  try {
    const { session, greeting, settings } = await voiceAgent.startCall({
      callSid: info.callSid,
      callerPhone: info.from,
    });

    // Salomlashuv OLDINDAN YOZILGAN fayl bo'lishi kerak (jonli TTS kechikish beradi)
    const greetingAudio = session.language === 'RU'
      ? config.speech.greetingAudioRu
      : config.speech.greetingAudioUz;
    const audioUrl = greetingAudio?.startsWith('http')
      ? greetingAudio
      : `${config.publicUrl}${greetingAudio}`;

    // Fayl mavjudligini tekshirmaymiz — mavjud bo'lmasa Twilio <Play> ni o'tkazib yuboradi,
    // shuning uchun matnli variant ham beriladi
    const fs = require('fs');
    const path = require('path');
    const localPath = path.join(__dirname, '..', '..', 'public', greetingAudio.replace(/^\//, ''));
    const hasAudio = fs.existsSync(localPath);

    return send(res, provider().answer({
      greetingAudioUrl: hasAudio ? audioUrl : null,
      greetingText: greeting,
      recordingNotice: STATIC.recordingNotice[session.language],
      sttLanguage: sttLanguageFor(session),
      gatherUrl: url('collect'),
    }));
  } catch (e) {
    logger.error('incoming xatosi', { message: e.message });
    // Qo'ng'iroq hech qachon jim tugamasin — raqamli menyuga tushamiz
    return send(res, provider().dtmfMenu({
      text: STATIC.dtmfMenu.UZ,
      sayLanguage: 'ru-RU',
      actionUrl: url('dtmf'),
    }));
  }
}

/** 2) Bemor gapirdi — AI javobi. */
async function collect(req, res) {
  const info = callInfo(req);

  try {
    // Bemor gapirish o'rniga raqam bosgan bo'lsa
    if (!info.speech && info.digits) {
      return dtmf(req, res);
    }

    const { say, action, session } = await voiceAgent.handleUtterance({
      callSid: info.callSid,
      text: info.speech,
      callerPhone: info.from,
    });

    const tts = await ttsService.synthesize(say, session.language);
    const settings = await settingsService.getSettings();

    if (action === 'TRANSFER') {
      const operator = settings.operatorPhone || config.telephony.operatorPhone;
      return send(res, provider().transfer({
        text: say,
        audioUrl: tts.url,
        sayLanguage: tts.sayLanguage,
        operatorNumber: operator,
      }));
    }

    if (action === 'HANGUP') {
      return send(res, provider().hangup({ text: say, audioUrl: tts.url, sayLanguage: tts.sayLanguage }));
    }

    return send(res, provider().sayAndGather({
      text: say,
      audioUrl: tts.url,
      sayLanguage: tts.sayLanguage,
      sttLanguage: sttLanguageFor(session),
      gatherUrl: url('collect'),
    }));
  } catch (e) {
    logger.error('collect xatosi', { message: e.message });
    const settings = await settingsService.getSettings();
    return send(res, provider().transfer({
      text: STATIC.technicalIssue.UZ,
      sayLanguage: 'ru-RU',
      operatorNumber: settings.operatorPhone || config.telephony.operatorPhone,
    }));
  }
}

/**
 * 3) Zaxira rejim: AI ishlamaganda raqamli menyu.
 *    1 — terapevt, 2 — pediatr, 0 — operator.
 */
async function dtmf(req, res) {
  const info = callInfo(req);
  const settings = await settingsService.getSettings();
  const session = voiceAgent.getSession(info.callSid);
  const lang = session?.language || 'UZ';

  if (!info.digits) {
    return send(res, provider().dtmfMenu({
      text: STATIC.dtmfMenu[lang],
      sayLanguage: 'ru-RU',
      actionUrl: url('dtmf'),
    }));
  }

  if (info.digits === '0') {
    if (session) session.outcome = 'ESCALATED';
    return send(res, provider().transfer({
      text: STATIC.transferring[lang],
      sayLanguage: 'ru-RU',
      operatorNumber: settings.operatorPhone || config.telephony.operatorPhone,
    }));
  }

  // 1 yoki 2: eng yaqin bo'sh vaqtga avtomatik yozish
  const specialtyName = info.digits === '2' ? 'Pediatr' : 'Terapevt';
  const specialty = await prisma.specialty.findFirst({ where: { nameUz: { contains: specialtyName } } });
  const service = specialty
    ? await prisma.service.findFirst({ where: { specialtyId: specialty.id, isActive: true, category: 'CONSULTATION' } })
    : null;

  if (!service) {
    return send(res, provider().transfer({
      text: STATIC.transferring[lang],
      sayLanguage: 'ru-RU',
      operatorNumber: settings.operatorPhone || config.telephony.operatorPhone,
    }));
  }

  const todayKey = time.dateKey(new Date());
  const { slots } = await availability.getAvailableSlots({
    serviceId: service.id,
    dateFrom: todayKey,
    dateTo: time.dateRange(todayKey, 7)[6],
    limit: 1,
  });

  if (slots.length === 0) {
    return send(res, provider().transfer({
      text: STATIC.transferring[lang],
      sayLanguage: 'ru-RU',
      operatorNumber: settings.operatorPhone || config.telephony.operatorPhone,
    }));
  }

  const slot = slots[0];
  try {
    const patient = await bookingService.findOrCreatePatient({
      phone: info.from,
      firstName: 'Bemor',
      source: 'VOICE',
      language: lang,
    });
    const { appointment } = await bookingService.createAppointment({
      patientId: patient.id,
      doctorId: slot.doctorId,
      serviceId: service.id,
      startTime: slot.startUtc,
      source: 'VOICE',
      idempotencyKey: `dtmf:${info.callSid}`,
      skipPatientChecks: true,
    });
    if (session) {
      session.createdAppointmentId = appointment.id;
      session.outcome = 'BOOKED';
    }

    const text = lang === 'RU'
      ? `Вы записаны: ${time.formatDateHuman(slot.startUtc, 'RU')}, в ${slot.time}, врач ${slot.doctorName}. Подробности отправим в SMS.`
      : `Yozildingiz: ${time.formatDateHuman(slot.startUtc, 'UZ')}, soat ${slot.time}, shifokor ${slot.doctorName}. Tafsilotlarni SMS orqali yuboramiz.`;
    const tts = await ttsService.synthesize(text, lang);
    return send(res, provider().hangup({ text, audioUrl: tts.url, sayLanguage: tts.sayLanguage }));
  } catch (e) {
    logger.error('DTMF navbat xatosi', { message: e.message });
    return send(res, provider().transfer({
      text: STATIC.transferring[lang],
      sayLanguage: 'ru-RU',
      operatorNumber: settings.operatorPhone || config.telephony.operatorPhone,
    }));
  }
}

/** 4) Qo'ng'iroq tugadi — CallLog yakunlanadi. */
async function status(req, res) {
  const info = callInfo(req);
  if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(String(info.status || '').toLowerCase())
      || req.body?.ended) {
    await voiceAgent.finishCall({ callSid: info.callSid, durationSec: info.duration });
  }
  return res.status(204).send();
}

/**
 * Test uchun: telefonsiz, matn orqali AI bilan suhbatlashish.
 * POST /api/voice/simulate  { callSid, text, from }
 */
async function simulate(req, res) {
  const { callSid = `sim-${Date.now()}`, text, from = '+998901234567', start } = req.body || {};

  if (start) {
    const { greeting } = await voiceAgent.startCall({ callSid, callerPhone: from });
    return res.json({ success: true, data: { callSid, say: greeting, action: 'CONTINUE' }, error: null });
  }

  const result = await voiceAgent.handleUtterance({ callSid, text, callerPhone: from });
  if (result.action !== 'CONTINUE') await voiceAgent.finishCall({ callSid });

  return res.json({
    success: true,
    data: {
      callSid,
      say: result.say,
      action: result.action,
      language: result.session.language,
      outcome: result.session.outcome,
      appointmentId: result.session.createdAppointmentId || null,
    },
    error: null,
  });
}

module.exports = { incoming, collect, dtmf, status, simulate };
