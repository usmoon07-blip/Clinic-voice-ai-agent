'use strict';
/** AI model bilan ishlash (Anthropic Messages API, tool use bilan). */
const axios = require('axios');
const config = require('../config/default');
const logger = require('../utils/logger');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/**
 * @param {Object} p
 * @param {string} p.system            system prompt
 * @param {Array}  p.messages          [{role, content}]
 * @param {Array}  p.tools             tool ta'riflari
 * @returns {Promise<{text: string, toolUses: Array, stopReason: string, raw: Object}>}
 */
async function complete({ system, messages, tools = [], maxTokens = config.ai.maxTokens }) {
  if (!config.ai.apiKey) {
    const err = new Error('AI kaliti sozlanmagan (ANTHROPIC_API_KEY)');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const body = {
    model: config.ai.model,
    max_tokens: maxTokens,
    system,
    messages,
    ...(tools.length ? { tools } : {}),
  };

  const res = await axios.post(ANTHROPIC_URL, body, {
    headers: {
      'x-api-key': config.ai.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    timeout: 20000,
  });

  const content = res.data?.content || [];
  const text = content.filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
  const toolUses = content.filter((c) => c.type === 'tool_use');

  return { text, toolUses, stopReason: res.data?.stop_reason, raw: res.data, assistantContent: content };
}

/** Til aniqlash — model chaqirmasdan, kirill/lotin va kalit so'zlar bo'yicha. */
function detectLanguage(text, fallback = 'UZ') {
  if (!text) return fallback;
  const cyrillic = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;

  // O'zbekcha lotin yozuvidagi tez-tez uchraydigan so'zlar
  const uzMarkers = /\b(salom|assalomu|yozil|navbat|shifokor|kerak|qachon|bugun|ertaga|rahmat|xo'p|mumkin)\b/i;
  if (uzMarkers.test(text)) return 'UZ';

  // Ruscha kalit so'zlar
  const ruMarkers = /\b(здравствуйте|запис|врач|нужно|когда|сегодня|завтра|спасибо|можно)\b/i;
  if (ruMarkers.test(text)) return 'RU';

  if (cyrillic > latin) return 'RU';
  if (latin > 0) return 'UZ';
  return fallback;
}

module.exports = { complete, detectLanguage };
