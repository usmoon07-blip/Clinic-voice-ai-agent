'use strict';
/**
 * AI VOICE AGENT — suhbat dvigateli.
 *
 * Har bir qo'ng'iroq uchun sessiya saqlanadi: suhbat tarixi, til, bemor,
 * tushunmovchiliklar soni va kechikish o'lchovlari.
 *
 * XAVFSIZLIK QATLAMLARI (AI dan OLDIN ishlaydi):
 *  1. Shoshilinch holat triaji  -> navbat to'xtatiladi, 103 + operator
 *  2. Tibbiy maslahat so'rovi   -> rad etiladi
 *  3. Operator so'rovi          -> darhol uzatiladi
 * AI faqat shundan keyin gapiradi va faqat toollar orqali ish ko'radi.
 */
const { prisma } = require('../database/connection');
const aiClient = require('./aiClient');
const voiceTools = require('../services/voiceTools');
const triage = require('../services/triageService');
const settingsService = require('../services/settingsService');
const identityService = require('../services/identityService');
const availability = require('../services/availabilityService');
const { buildSystemPrompt, STATIC } = require('../config/voicePrompt');
const config = require('../config/default');
const time = require('../utils/time');
const phoneUtil = require('../utils/phone');
const logger = require('../utils/logger');

/** Faol qo'ng'iroqlar (xotirada). Qo'ng'iroq tugagach tozalanadi. */
const sessions = new Map();

function createSession({ callSid, callerPhone }) {
  const session = {
    callSid,
    callerPhone: phoneUtil.normalize(callerPhone),
    language: 'UZ',
    messages: [],
    transcript: [],
    misunderstandCount: 0,
    latencies: [],
    turn: 0,
    startedAt: Date.now(),
    knownPatientId: null,
    verifiedPatientId: null,
    patientAge: null,
    lastSlots: [],
    outcome: 'DROPPED',
    transferRequested: false,
    shouldEnd: false,
    emergency: false,
  };
  sessions.set(callSid, session);
  return session;
}

function getSession(callSid) {
  return sessions.get(callSid) || null;
}

function endSession(callSid) {
  sessions.delete(callSid);
}

/** Transkriptga yozish (raqamlar maskalanadi). */
function pushTranscript(session, role, text) {
  if (!text) return;
  session.transcript.push(`[${role}] ${text}`);
}

/** Qo'ng'iroq boshlanishi: sessiya + CallLog yozuvi + salomlashuv matni. */
async function startCall({ callSid, callerPhone }) {
  const session = createSession({ callSid, callerPhone });
  const settings = await settingsService.getSettings();

  // Qo'ng'iroq qilgan raqam bo'yicha bemorni oldindan topib qo'yamiz
  const patient = session.callerPhone ? await identityService.findByPhone(session.callerPhone) : null;
  if (patient) {
    session.knownPatientId = patient.id;
    session.language = patient.language || 'UZ';
    session.patientAge = availability.ageFromBirthDate(patient.birthDate);
    session.knownFirstName = patient.firstName;
  }

  await prisma.callLog.upsert({
    where: { callSid },
    update: {},
    create: {
      callSid,
      phone: session.callerPhone || 'unknown',
      startedAt: new Date(),
      outcome: 'DROPPED',
      deleteAfter: new Date(Date.now() + (settings.recordingRetentionDays ?? 90) * 86400000),
    },
  }).catch((e) => logger.error('CallLog yaratilmadi', { message: e.message }));

  const greeting = STATIC.greeting[session.language](settings.clinicName);
  pushTranscript(session, 'AI', greeting);
  return { session, greeting, settings };
}

/** AI ga beriladigan system prompt. */
async function systemPromptFor(session) {
  const settings = await settingsService.getSettings();
  const nowT = time.now();
  let prompt = buildSystemPrompt({
    clinicName: settings.clinicName,
    emergencyPhone: settings.emergencyPhone,
    address: settings.address,
    workingHours: settings.workingHoursText,
    language: session.language,
    todayHuman: time.formatDateHuman(new Date(), session.language),
    nowTime: nowT.toFormat('HH:mm'),
  });

  // Qo'ng'iroq qilgan raqam va tanilgan bemor haqidagi kontekst
  const lines = [];
  if (session.callerPhone) {
    lines.push(`Qo'ng'iroq qilingan raqam: ${phoneUtil.speakable(session.callerPhone)} (${session.callerPhone}).`);
  }
  if (session.knownPatientId) {
    lines.push(`Bu raqam bazada bor. patient_id=${session.knownPatientId}, ismi: ${session.knownFirstName}.`);
    lines.push('YANGI navbat uchun shaxsni tasdiqlash shart emas. MAVJUD navbat haqida gapirishdan oldin verify_patient_identity ni chaqir.');
  } else {
    lines.push('Bu raqam bazada yo\'q — yangi bemor. Ismini so\'rab, create_patient ni chaqir.');
  }
  if (lines.length) prompt += `\n\nKONTEKST:\n${lines.join('\n')}`;
  return prompt;
}

/**
 * Bemorning bitta gapini qayta ishlash.
 * @returns {Promise<{say: string, action: 'CONTINUE'|'TRANSFER'|'HANGUP', session: Object}>}
 */
async function handleUtterance({ callSid, text, callerPhone }) {
  let session = getSession(callSid);
  if (!session) session = createSession({ callSid, callerPhone });

  const started = Date.now();
  session.turn += 1;

  // Bemor jim qolsa / STT hech narsa tanimasa
  if (!text || !text.trim()) {
    session.misunderstandCount += 1;
    if (session.misunderstandCount >= config.ai.maxMisunderstandings) {
      session.outcome = 'ESCALATED';
      return { say: STATIC.transferring[session.language], action: 'TRANSFER', session };
    }
    return { say: STATIC.notUnderstood[session.language], action: 'CONTINUE', session };
  }

  pushTranscript(session, 'Bemor', text);

  // Tilni aniqlash (birinchi gaplarda)
  if (session.turn <= 2) {
    session.language = aiClient.detectLanguage(text, session.language);
  }

  const settings = await settingsService.getSettings();

  // ── 1-qatlam: shoshilinch holat ──
  const emergency = triage.detectEmergency(text);
  if (emergency.isEmergency) {
    session.emergency = true;
    session.outcome = 'EMERGENCY';
    const say = STATIC.emergency[session.language](settings.emergencyPhone);
    pushTranscript(session, 'AI', say);
    logger.warn('Shoshilinch holat aniqlandi', { callSid, matched: emergency.matched });
    return { say, action: 'TRANSFER', session };
  }

  // ── 2-qatlam: operator so'rovi ──
  if (triage.wantsOperator(text)) {
    session.outcome = 'ESCALATED';
    const say = STATIC.transferring[session.language];
    pushTranscript(session, 'AI', say);
    return { say, action: 'TRANSFER', session };
  }

  // ── 3-qatlam: AI suhbati (tool use bilan) ──
  session.messages.push({ role: 'user', content: text });

  let say = '';
  let action = 'CONTINUE';

  try {
    const system = await systemPromptFor(session);
    let guard = 0;

    // Model tool chaqirsa — bajaramiz va natijani qaytarib beramiz (ketma-ket)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      guard += 1;
      if (guard > 6) break; // cheksiz tsikldan himoya

      const result = await aiClient.complete({
        system,
        messages: session.messages,
        tools: voiceTools.TOOL_DEFINITIONS,
      });

      if (result.text) say = result.text;

      if (result.toolUses.length === 0) {
        session.messages.push({ role: 'assistant', content: result.assistantContent });
        break;
      }

      session.messages.push({ role: 'assistant', content: result.assistantContent });

      const toolResults = [];
      for (const call of result.toolUses) {
        // eslint-disable-next-line no-await-in-loop
        const output = await voiceTools.execute(call.name, call.input, session);
        logger.debug('Tool bajarildi', { name: call.name });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(output),
        });
      }
      session.messages.push({ role: 'user', content: toolResults });
    }
  } catch (e) {
    logger.error('AI xatosi', { callSid, message: e.message });
    session.outcome = 'ESCALATED';
    const fallback = STATIC.technicalIssue[session.language];
    pushTranscript(session, 'AI', fallback);
    return { say: fallback, action: 'TRANSFER', session };
  }

  // Tool lar sessiyaga qo'ygan bayroqlar
  if (session.transferRequested) {
    action = 'TRANSFER';
    if (!say) say = STATIC.transferring[session.language];
  } else if (session.shouldEnd) {
    action = 'HANGUP';
    if (!say) say = STATIC.goodbye[session.language];
  }

  if (!say) {
    session.misunderstandCount += 1;
    say = STATIC.notUnderstood[session.language];
    if (session.misunderstandCount >= config.ai.maxMisunderstandings) {
      session.outcome = 'ESCALATED';
      action = 'TRANSFER';
      say = STATIC.transferring[session.language];
    }
  }

  if (session.createdAppointmentId) session.outcome = 'BOOKED';

  const latency = Date.now() - started;
  session.latencies.push(latency);
  if (latency > 3000) logger.warn('Javob kechikdi', { callSid, latency });

  pushTranscript(session, 'AI', say);
  return { say, action, session };
}

/** Qo'ng'iroq tugadi: CallLog ni yakunlash va sessiyani tozalash. */
async function finishCall({ callSid, durationSec = null }) {
  const session = getSession(callSid);
  if (!session) return null;

  const avgLatency = session.latencies.length
    ? Math.round(session.latencies.reduce((a, b) => a + b, 0) / session.latencies.length)
    : null;

  // Transkriptda telefon raqamlari maskalangan holda saqlanadi
  const transcript = logger.sanitize(session.transcript.join('\n'));

  const data = {
    endedAt: new Date(),
    durationSec: durationSec ?? Math.round((Date.now() - session.startedAt) / 1000),
    outcome: session.outcome,
    transcript,
    detectedLanguage: session.language,
    misunderstandCount: session.misunderstandCount,
    avgLatencyMs: avgLatency,
    appointmentId: session.createdAppointmentId || null,
  };

  try {
    // upsert — qo'ng'iroq startCall siz boshlangan bo'lsa ham jurnal yozilsin
    await prisma.callLog.upsert({
      where: { callSid },
      update: data,
      create: {
        callSid,
        phone: session.callerPhone || 'unknown',
        startedAt: new Date(session.startedAt),
        ...data,
      },
    });
  } catch (e) {
    logger.error('CallLog yakunlanmadi', { callSid, message: e.message });
  }

  // Ish vaqtidan tashqari eskalatsiya bo'lsa — qayta qo'ng'iroq so'rovi
  if (session.transferRequested && session.callerPhone) {
    const hour = time.now().hour;
    const afterHours = hour < 8 || hour >= 18;
    if (afterHours) {
      await prisma.callbackRequest.create({
        data: {
          phone: session.callerPhone,
          reason: session.transferReason || 'ESCALATED',
          note: session.emergency ? 'SHOSHILINCH' : null,
        },
      }).catch(() => {});
    }
  }

  endSession(callSid);
  return session;
}

module.exports = {
  sessions,
  createSession,
  getSession,
  endSession,
  startCall,
  handleUtterance,
  finishCall,
  systemPromptFor,
};
