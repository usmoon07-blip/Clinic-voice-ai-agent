'use strict';
/** Twilio provayderi — TwiML javoblari. */
const { TelephonyProvider, escapeXml } = require('./provider.interface');
const config = require('../config/default');

const CONTENT_TYPE = 'text/xml';

function wrap(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${inner}\n</Response>`;
}

/** Matnni aytish: audio fayl bo'lsa <Play>, bo'lmasa <Say>. */
function speak({ text, audioUrl, sayLanguage = 'ru-RU' }) {
  if (audioUrl) return `  <Play>${escapeXml(audioUrl)}</Play>`;
  return `  <Say language="${sayLanguage}">${escapeXml(text)}</Say>`;
}

/**
 * Nutqni tinglash. `speechTimeout="auto"` — bemor gapirishni tugatishi bilan
 * webhook chaqiriladi (barge-in ga yaqin tabiiy his beradi).
 */
function gather({ actionUrl, language = 'uz-UZ', inner = '', timeout = 6 }) {
  return `  <Gather input="speech dtmf" language="${escapeXml(language)}" speechTimeout="auto" timeout="${timeout}" numDigits="1" action="${escapeXml(actionUrl)}" method="POST" actionOnEmptyResult="true">
${inner}
  </Gather>`;
}

class TwilioProvider extends TelephonyProvider {
  get contentType() { return CONTENT_TYPE; }

  /**
   * Qo'ng'iroqqa javob. Salomlashuv OLDINDAN YOZILGAN audio fayl bo'lishi kerak —
   * 3 soniya qoidasini buzmaslik uchun jonli TTS ishlatilmaydi.
   */
  answer({ greetingAudioUrl, greetingText, sttLanguage, gatherUrl, recordingNotice }) {
    const parts = [];
    if (greetingAudioUrl) {
      parts.push(`  <Play>${escapeXml(greetingAudioUrl)}</Play>`);
    } else {
      parts.push(speak({ text: greetingText, sayLanguage: 'ru-RU' }));
    }
    if (recordingNotice) parts.push(speak({ text: recordingNotice, sayLanguage: 'ru-RU' }));

    return wrap(gather({ actionUrl: gatherUrl, language: sttLanguage, inner: parts.join('\n') }));
  }

  sayAndGather({ text, audioUrl, sayLanguage, sttLanguage, gatherUrl }) {
    return wrap(
      `${gather({
        actionUrl: gatherUrl,
        language: sttLanguage,
        inner: speak({ text, audioUrl, sayLanguage }),
      })}\n  <Redirect method="POST">${escapeXml(gatherUrl)}</Redirect>`,
    );
  }

  transfer({ text, audioUrl, sayLanguage, operatorNumber }) {
    const parts = [speak({ text, audioUrl, sayLanguage })];
    if (operatorNumber) {
      parts.push(`  <Dial timeout="25" callerId="${escapeXml(config.telephony.twilio.phoneNumber)}">${escapeXml(operatorNumber)}</Dial>`);
    } else {
      parts.push('  <Hangup/>');
    }
    return wrap(parts.join('\n'));
  }

  hangup({ text, audioUrl, sayLanguage }) {
    return wrap(`${speak({ text, audioUrl, sayLanguage })}\n  <Hangup/>`);
  }

  /** AI ishlamay qolganda: raqamli menyu (qo'ng'iroq jim tugamasin). */
  dtmfMenu({ text, sayLanguage, actionUrl }) {
    return wrap(
      `  <Gather input="dtmf" numDigits="1" timeout="8" action="${escapeXml(actionUrl)}" method="POST">
${speak({ text, sayLanguage })}
  </Gather>
  <Hangup/>`,
    );
  }
}

module.exports = new TwilioProvider();
