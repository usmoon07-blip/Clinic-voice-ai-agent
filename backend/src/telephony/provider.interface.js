'use strict';
/**
 * Telefoniya provayderi interfeysi.
 *
 * Nima uchun kerak: Twilio O'zbekiston raqamlarini sotmaydi. Shuning uchun
 * mahalliy SIP trunk (Asterisk/FreeSWITCH) ga o'tish imkoni bo'lishi kerak.
 * `.env` dagi TELEPHONY_PROVIDER qiymati bilan almashtiriladi.
 *
 * Har bir provayder quyidagilarni qaytaradi:
 *   answer({ audioUrl, text, language, gatherUrl })   -> qo'ng'iroqqa javob + tinglash
 *   sayAndGather({ ... })                             -> gapirish + keyingi javobni kutish
 *   transfer({ text, language, operatorNumber })      -> operatorga uzatish
 *   hangup({ text, language })                        -> xayrlashib tugatish
 *   dtmfMenu({ text, language, actionUrl })           -> AI ishlamaganda raqamli menyu
 */

class TelephonyProvider {
  // eslint-disable-next-line no-unused-vars
  answer(params) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  sayAndGather(params) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  transfer(params) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  hangup(params) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  dtmfMenu(params) { throw new Error('not implemented'); }
}

/** XML uchun maxsus belgilarni ekranlash. */
function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { TelephonyProvider, escapeXml };
