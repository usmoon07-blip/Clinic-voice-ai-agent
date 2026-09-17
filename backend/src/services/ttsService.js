'use strict';
/**
 * TTS (matndan nutq).
 *
 * MUHIM (halol ogohlantirish): Twilio ning o'rnatilgan <Say> ovozi O'ZBEK TILINI
 * qo'llab-quvvatlamaydi. Shuning uchun:
 *   - TTS_PROVIDER=elevenlabs bo'lsa  -> audio fayl generatsiya qilinadi va <Play> bilan qo'yiladi
 *   - aks holda                       -> <Say language="ru-RU"> ga qaytiladi va log da ogohlantiriladi
 * Rus tilida Twilio <Say> yaxshi ishlaydi.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config/default');
const logger = require('../utils/logger');

const OUT_DIR = path.join(__dirname, '..', '..', 'public', 'tts');

function ensureDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function cacheKey(text, lang) {
  return crypto.createHash('sha1').update(`${lang}:${text}`).digest('hex').slice(0, 20);
}

/**
 * Matnni audio faylga aylantiradi.
 * @returns {Promise<{url: string|null, useSay: boolean, sayLanguage: string}>}
 */
async function synthesize(text, language = 'UZ') {
  const provider = config.speech.ttsProvider;

  if (provider === 'elevenlabs' && config.speech.elevenLabsKey) {
    try {
      ensureDir();
      const name = `${cacheKey(text, language)}.mp3`;
      const filePath = path.join(OUT_DIR, name);

      if (!fs.existsSync(filePath)) {
        const res = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${config.speech.elevenLabsVoiceId}`,
          {
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.7 },
          },
          {
            headers: { 'xi-api-key': config.speech.elevenLabsKey, 'content-type': 'application/json' },
            responseType: 'arraybuffer',
            timeout: 15000,
          },
        );
        fs.writeFileSync(filePath, Buffer.from(res.data));
      }
      return { url: `${config.publicUrl}/tts/${name}`, useSay: false, sayLanguage: 'ru-RU' };
    } catch (e) {
      logger.error('ElevenLabs TTS xatosi, <Say> ga qaytilmoqda', { message: e.message });
    }
  }

  if (language === 'UZ' && provider !== 'elevenlabs') {
    logger.warn('O\'zbekcha TTS mavjud emas — Twilio <Say> ru-RU ovozi ishlatilmoqda. '
      + 'Sifat uchun TTS_PROVIDER=elevenlabs ni yoqing.');
  }

  return { url: null, useSay: true, sayLanguage: language === 'RU' ? 'ru-RU' : 'ru-RU' };
}

module.exports = { synthesize };
