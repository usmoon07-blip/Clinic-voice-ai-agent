'use strict';
/** SiteSetting ni o'qish (qisqa muddatli kesh bilan). */
const { prisma } = require('../database/connection');
const config = require('../config/default');

let cache = null;
let cachedAt = 0;
const TTL_MS = 30_000;

const FALLBACK = {
  id: 1,
  clinicName: config.clinic.name,
  phone: config.clinic.phone,
  address: config.clinic.address,
  latitude: config.clinic.latitude,
  longitude: config.clinic.longitude,
  workingHoursText: 'Dush-Juma 09:00-17:00',
  cancellationWindowMinutes: config.booking.cancellationWindowMinutes,
  minLeadTimeMinutes: config.booking.minLeadTimeMinutes,
  appointmentBufferMinutes: config.booking.bufferMinutes,
  noShowThreshold: config.booking.noShowThreshold,
  recordingRetentionDays: config.booking.recordingRetentionDays,
  discreetModeDefault: true,
  emergencyPhone: config.clinic.emergencyPhone,
  operatorPhone: config.telephony.operatorPhone || null,
};

async function getSettings({ force = false } = {}) {
  if (!force && cache && Date.now() - cachedAt < TTL_MS) return cache;
  try {
    const row = await prisma.siteSetting.findUnique({ where: { id: 1 } });
    cache = row || FALLBACK;
  } catch (e) {
    cache = FALLBACK;
  }
  cachedAt = Date.now();
  return cache;
}

function invalidate() {
  cache = null;
  cachedAt = 0;
}

module.exports = { getSettings, invalidate, FALLBACK };
