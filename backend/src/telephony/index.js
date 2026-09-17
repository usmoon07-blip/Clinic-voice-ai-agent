'use strict';
/** Faol telefoniya provayderini tanlash (.env: TELEPHONY_PROVIDER). */
const config = require('../config/default');
const logger = require('../utils/logger');

function getProvider() {
  switch (config.telephony.provider) {
    case 'sip':
      return require('./sip.provider');
    case 'twilio':
    default:
      if (config.telephony.provider !== 'twilio') {
        logger.warn(`Noma'lum TELEPHONY_PROVIDER="${config.telephony.provider}", twilio ishlatilmoqda`);
      }
      return require('./twilio.provider');
  }
}

module.exports = { getProvider };
