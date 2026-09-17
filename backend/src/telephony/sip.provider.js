'use strict';
/**
 * SIP / Asterisk (ARI) provayderi — O'zbekistondagi mahalliy raqamlar uchun.
 *
 * Twilio TwiML o'rniga bu yerda JSON buyruqlari qaytariladi; ularni Asterisk ARI
 * ulagichi (stasis app) bajaradi: audio o'ynatish, nutqni yig'ish, operatorga
 * uzatish, tugatish.
 *
 * Asterisk dialplan namunasi (extensions.conf):
 *   [from-trunk]
 *   exten => _X.,1,NoOp(Klinika AI)
 *    same => n,Stasis(clinic-voice)
 *    same => n,Hangup()
 */
const axios = require('axios');
const { TelephonyProvider } = require('./provider.interface');
const config = require('../config/default');
const logger = require('../utils/logger');

const CONTENT_TYPE = 'application/json';

function ariClient() {
  const { ariUrl, ariUser, ariPassword } = config.telephony.sip;
  return axios.create({
    baseURL: `${ariUrl}/ari`,
    auth: { username: ariUser, password: ariPassword },
    timeout: 8000,
  });
}

class SipProvider extends TelephonyProvider {
  get contentType() { return CONTENT_TYPE; }

  answer({ greetingAudioUrl, greetingText, gatherUrl }) {
    return JSON.stringify({
      commands: [
        { type: 'answer' },
        greetingAudioUrl ? { type: 'play', url: greetingAudioUrl } : { type: 'tts', text: greetingText },
        { type: 'listen', callbackUrl: gatherUrl },
      ],
    });
  }

  sayAndGather({ text, audioUrl, gatherUrl }) {
    return JSON.stringify({
      commands: [
        audioUrl ? { type: 'play', url: audioUrl } : { type: 'tts', text },
        { type: 'listen', callbackUrl: gatherUrl },
      ],
    });
  }

  transfer({ text, audioUrl, operatorNumber }) {
    return JSON.stringify({
      commands: [
        audioUrl ? { type: 'play', url: audioUrl } : { type: 'tts', text },
        { type: 'transfer', extension: operatorNumber || config.telephony.sip.operatorExtension },
      ],
    });
  }

  hangup({ text, audioUrl }) {
    return JSON.stringify({
      commands: [
        audioUrl ? { type: 'play', url: audioUrl } : { type: 'tts', text },
        { type: 'hangup' },
      ],
    });
  }

  dtmfMenu({ text, actionUrl }) {
    return JSON.stringify({
      commands: [
        { type: 'tts', text },
        { type: 'readDigits', maxDigits: 1, callbackUrl: actionUrl },
      ],
    });
  }

  /** Asterisk kanalini to'g'ridan-to'g'ri boshqarish (ixtiyoriy yordamchi). */
  async hangupChannel(channelId) {
    try {
      await ariClient().delete(`/channels/${channelId}`);
    } catch (e) {
      logger.error('ARI hangup xatosi', { message: e.message });
    }
  }
}

module.exports = new SipProvider();
