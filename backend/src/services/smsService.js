'use strict';
/** SMS yuborish. Provayder `.env` dagi SMS_PROVIDER bilan tanlanadi. */
const axios = require('axios');
const config = require('../config/default');
const logger = require('../utils/logger');
const phoneUtil = require('../utils/phone');

let twilioClient = null;
function getTwilio() {
  if (twilioClient) return twilioClient;
  const { accountSid, authToken } = config.telephony.twilio;
  if (!accountSid || !authToken) return null;
  // eslint-disable-next-line global-require
  const twilio = require('twilio');
  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

let eskizToken = null;
async function getEskizToken() {
  if (eskizToken) return eskizToken;
  const { email, password } = config.sms.eskiz;
  if (!email || !password) return null;
  const res = await axios.post('https://notify.eskiz.uz/api/auth/login', { email, password });
  eskizToken = res.data?.data?.token || null;
  return eskizToken;
}

/**
 * @returns {Promise<{sent: boolean, provider: string, error?: string}>}
 */
async function send(to, text) {
  const phone = phoneUtil.normalize(to);
  if (!phone) return { sent: false, provider: 'none', error: 'BAD_PHONE' };

  const provider = config.sms.provider;

  try {
    if (provider === 'twilio') {
      const client = getTwilio();
      if (!client) throw new Error('Twilio kalitlari sozlanmagan');
      await client.messages.create({
        body: text,
        from: config.telephony.twilio.phoneNumber,
        to: phone,
      });
      return { sent: true, provider };
    }

    if (provider === 'eskiz') {
      const token = await getEskizToken();
      if (!token) throw new Error('Eskiz kalitlari sozlanmagan');
      await axios.post(
        'https://notify.eskiz.uz/api/message/sms/send',
        { mobile_phone: phone.replace('+', ''), message: text, from: config.sms.eskiz.from },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return { sent: true, provider };
    }

    logger.info('SMS provayderi sozlanmagan, xabar yuborilmadi', { to: phoneUtil.mask(phone) });
    return { sent: false, provider: 'none', error: 'NOT_CONFIGURED' };
  } catch (e) {
    // Eskiz tokeni eskirgan bo'lishi mumkin — keyingi urinishda yangilansin
    eskizToken = null;
    logger.error('SMS yuborilmadi', { to: phoneUtil.mask(phone), message: e.message });
    return { sent: false, provider, error: e.message };
  }
}

module.exports = { send };
