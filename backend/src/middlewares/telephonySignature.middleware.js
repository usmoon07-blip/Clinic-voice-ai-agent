'use strict';
/**
 * Telefoniya webhookini himoyalash: provayder imzosi tekshiriladi,
 * aks holda soxta so'rov bilan tizimga navbat yozib qo'yish mumkin bo'lardi.
 */
const config = require('../config/default');
const logger = require('../utils/logger');

function validateTelephonySignature(req, res, next) {
  const provider = config.telephony.provider;

  if (provider === 'twilio') {
    if (!config.telephony.twilio.validateSignature) {
      logger.warn('Twilio imzo tekshiruvi o\'chirilgan (faqat localhost testi uchun)');
      return next();
    }
    // eslint-disable-next-line global-require
    const twilio = require('twilio');
    const signature = req.headers['x-twilio-signature'];
    const url = `${config.publicUrl}${req.originalUrl}`;
    const valid = twilio.validateRequest(
      config.telephony.twilio.authToken,
      signature,
      url,
      req.body || {},
    );
    if (!valid) {
      logger.error('Twilio imzosi noto\'g\'ri — so\'rov rad etildi');
      return res.status(403).send('Invalid signature');
    }
    return next();
  }

  if (provider === 'sip') {
    // Asterisk ARI localhostdan keladi; qo'shimcha shared secret ham tekshiriladi
    const token = req.headers['x-sip-token'];
    if (config.telephony.sip.ariPassword && token !== config.telephony.sip.ariPassword) {
      return res.status(403).send('Invalid token');
    }
    return next();
  }

  return next();
}

module.exports = { validateTelephonySignature };
