'use strict';
/** Audit jurnali: kim kimning ma'lumotini ko'rgani/o'zgartirgani yozib boriladi. */
const { prisma } = require('../database/connection');
const logger = require('../utils/logger');

/**
 * @param {Object} p
 * @param {number|null} p.adminUserId
 * @param {'CREATE'|'UPDATE'|'DELETE'|'VIEW'|'LOGIN'|'LOGIN_FAILED'} p.action
 * @param {string} p.entity
 */
async function record({ adminUserId = null, action, entity, entityId = null, oldValue = null, newValue = null, ip = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId,
        action,
        entity,
        entityId: entityId === null ? null : String(entityId),
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
        ip,
      },
    });
  } catch (e) {
    // Audit yozuvi asosiy amalni to'xtatmasligi kerak
    logger.error('Audit yozib bo\'lmadi', { message: e.message });
  }
}

/** Express uchun qulay yordamchi. */
function fromRequest(req) {
  return {
    adminUserId: req.admin?.id ?? null,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null,
  };
}

module.exports = { record, fromRequest };
