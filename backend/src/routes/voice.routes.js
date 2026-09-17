'use strict';
/** Voice Agent webhooklari — telefoniya provayderi imzosi tekshiriladi. */
const express = require('express');
const ctrl = require('../controllers/voiceController');
const { validateTelephonySignature } = require('../middlewares/telephonySignature.middleware');
const { voiceLimiter } = require('../middlewares/rateLimit.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const config = require('../config/default');

const router = express.Router();

router.post('/incoming', voiceLimiter, validateTelephonySignature, asyncHandler(ctrl.incoming));
router.post('/collect', validateTelephonySignature, asyncHandler(ctrl.collect));
router.post('/dtmf', validateTelephonySignature, asyncHandler(ctrl.dtmf));
router.post('/status', validateTelephonySignature, asyncHandler(ctrl.status));

// Faqat dev rejimda: telefonsiz matnli test
if (config.env === 'development') {
  router.post('/simulate', asyncHandler(ctrl.simulate));
}

module.exports = router;
