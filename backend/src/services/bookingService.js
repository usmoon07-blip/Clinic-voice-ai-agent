'use strict';
/**
 * Navbat yaratish / bekor qilish / ko'chirish — yagona manba.
 * Mini App, Admin panel va AI Voice Agent aynan shu funksiyalarni chaqiradi.
 */
const { prisma } = require('../database/connection');
const availability = require('./availabilityService');
const cancellationPolicy = require('./cancellationPolicyService');
const notificationService = require('./notificationService');
const settingsService = require('./settingsService');
const identityService = require('./identityService');
const phoneUtil = require('../utils/phone');
const time = require('../utils/time');
const logger = require('../utils/logger');

class BookingError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/** Telefon bo'yicha bemorni topadi yoki yangisini yaratadi. */
async function findOrCreatePatient({
  phone, firstName, lastName = null, birthDate = null, gender = null,
  telegramId = null, source = 'TELEGRAM', language = 'UZ', guardianId = null,
  relationToGuardian = 'SELF',
}) {
  const normalized = phoneUtil.normalize(phone);
  if (!normalized) throw new BookingError('BAD_PHONE', 'Telefon raqami noto\'g\'ri');

  const existing = await prisma.patient.findUnique({ where: { phone: normalized } });
  if (existing) {
    const patch = {};
    if (telegramId && !existing.telegramId) patch.telegramId = String(telegramId);
    if (birthDate && !existing.birthDate) patch.birthDate = new Date(birthDate);
    if (firstName && existing.firstName !== firstName && !existing.lastName) patch.firstName = firstName;
    if (Object.keys(patch).length === 0) return existing;
    return prisma.patient.update({ where: { id: existing.id }, data: patch });
  }

  const settings = await settingsService.getSettings();
  return prisma.patient.create({
    data: {
      phone: normalized,
      firstName: firstName || 'Bemor',
      lastName,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender,
      telegramId: telegramId ? String(telegramId) : null,
      source,
      language,
      guardianId,
      relationToGuardian,
      discreetMode: settings.discreetModeDefault ?? true,
      medicalCardNumber: await identityService.generateCardNumber(),
    },
  });
}

/** Oila a'zosi (masalan bola) profilini yaratish — telefon kattanikidan olinadi. */
async function createFamilyMember({ guardianId, firstName, lastName, birthDate, gender, relation = 'CHILD' }) {
  const guardian = await prisma.patient.findUnique({ where: { id: Number(guardianId) } });
  if (!guardian) throw new BookingError('GUARDIAN_NOT_FOUND', 'Qaramog\'idagi shaxs topilmadi');

  // Oila a'zosining telefoni kattanikiga qo'shimcha suffiks bilan saqlanadi (unikal bo'lishi uchun)
  const count = await prisma.patient.count({ where: { guardianId: guardian.id } });
  const syntheticPhone = `${guardian.phone}#${count + 1}`;

  return prisma.patient.create({
    data: {
      phone: syntheticPhone,
      firstName,
      lastName: lastName || guardian.lastName,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender,
      guardianId: guardian.id,
      relationToGuardian: relation,
      language: guardian.language,
      source: guardian.source,
      discreetMode: guardian.discreetMode,
      medicalCardNumber: await identityService.generateCardNumber(),
    },
  });
}

/** Bemorga onlayn navbat olishga ruxsat bormi? */
async function assertPatientAllowed(patient) {
  const settings = await settingsService.getSettings();
  if (patient.isBlacklisted) throw new BookingError('BLACKLISTED', 'Onlayn navbat cheklangan');
  if ((patient.noShowCount || 0) >= (settings.noShowThreshold ?? 3)) {
    throw new BookingError('NO_SHOW_LIMIT', 'Kelmaganlar soni chegaradan oshgan');
  }
}

/** Birlamchi qabulmi yoki takroriymi? */
async function detectVisitType(patientId, doctorId) {
  const previous = await prisma.appointment.count({
    where: { patientId: Number(patientId), doctorId: Number(doctorId), status: 'COMPLETED' },
  });
  return previous > 0 ? 'FOLLOW_UP' : 'FIRST';
}

/**
 * Navbat yaratish.
 * - slot yaratishdan oldin QAYTA tekshiriladi
 * - unikal cheklov (doctorId,startTime) / (roomId,startTime) ikki marta bandlikni to'xtatadi
 * - idempotencyKey bir xil bo'lsa, ikkinchi chaqiruv mavjud navbatni qaytaradi
 */
async function createAppointment({
  patientId, doctorId, serviceId, startTime, source = 'TELEGRAM',
  bookedByPhone = null, patientNote = null, idempotencyKey = null,
  courseId = null, sessionNumber = null, skipPatientChecks = false,
}) {
  if (idempotencyKey) {
    const existing = await prisma.appointment.findUnique({
      where: { idempotencyKey: String(idempotencyKey) },
      include: { doctor: true, service: true, room: true, patient: true },
    });
    if (existing) return { appointment: existing, duplicate: true };
  }

  const patient = await prisma.patient.findUnique({ where: { id: Number(patientId) } });
  if (!patient) throw new BookingError('PATIENT_NOT_FOUND', 'Bemor topilmadi');
  if (!skipPatientChecks) await assertPatientAllowed(patient);

  const patientAge = availability.ageFromBirthDate(patient.birthDate);
  const start = startTime instanceof Date ? startTime : new Date(startTime);

  const check = await availability.checkSlot({
    doctorId, serviceId, startTime: start, patientAge,
  });
  if (!check.ok) throw new BookingError(check.reason, 'Bu vaqtga yozib bo\'lmadi');

  const visitType = await detectVisitType(patient.id, doctorId);
  const price = visitType === 'FOLLOW_UP' && check.service.category === 'CONSULTATION'
    ? check.doctor.followUpPrice || check.service.price
    : check.service.price;

  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: Number(doctorId),
        serviceId: Number(serviceId),
        roomId: check.roomId,
        startTime: start,
        endTime: check.endTime,
        visitType,
        price,
        status: 'CONFIRMED',
        source,
        bookedByPhone: bookedByPhone ? phoneUtil.normalize(bookedByPhone) : null,
        patientNote,
        idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
        courseId: courseId ? Number(courseId) : null,
        sessionNumber,
      },
      include: { doctor: true, service: true, room: true, patient: true },
    });
  } catch (e) {
    // P2002 = unique constraint: shu vaqtni kimdir hozirgina band qildi
    if (e.code === 'P2002') throw new BookingError('SLOT_TAKEN', 'Bu vaqt hozirgina band bo\'ldi');
    throw e;
  }

  // Bildirishnoma navbat yaratilishini bloklamasin
  notificationService.onAppointmentCreated(appointment.id).catch((err) =>
    logger.error('Tasdiq xabari yuborilmadi', { message: err.message }));

  return { appointment, duplicate: false };
}

/** Navbatni bekor qilish (bekor qilish oynasi qoidasi bilan). */
async function cancelAppointment({ appointmentId, actor = 'PATIENT', reason = null, byClinic = false }) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: Number(appointmentId) },
  });
  if (!appointment) throw new BookingError('NOT_FOUND', 'Navbat topilmadi');

  const policy = await cancellationPolicy.canCancel(appointment, { actor });
  if (!policy.allowed) {
    const err = new BookingError(policy.reason, cancellationPolicy.explain(policy));
    err.policy = policy;
    throw err;
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: 'CANCELLED',
      cancelledBy: actor,
      cancelReason: reason,
      cancelledAt: new Date(),
    },
  });

  notificationService.onAppointmentCancelled(updated.id, { byClinic }).catch((err) =>
    logger.error('Bekor qilish xabari yuborilmadi', { message: err.message }));

  // Bo'shagan joyni kutish ro'yxatiga taklif qilish
  // (aylanma importdan qochish uchun kechiktirib yuklanadi)
  setImmediate(() => {
    // eslint-disable-next-line global-require
    require('./waitlistService')
      .offerFreedSlot(updated)
      .catch((err) => logger.error('Kutish ro\'yxati taklifi xatosi', { message: err.message }));
  });

  return updated;
}

/** Navbatni ko'chirish: eski bekor qilinadi, yangisi yaratiladi (bitta tranzaksiyada emas — slot tekshiruvi bilan). */
async function rescheduleAppointment({ appointmentId, newStartTime, actor = 'PATIENT' }) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: Number(appointmentId) },
    include: { patient: true },
  });
  if (!appointment) throw new BookingError('NOT_FOUND', 'Navbat topilmadi');

  const policy = await cancellationPolicy.canReschedule(appointment, { actor });
  if (!policy.allowed) {
    const err = new BookingError(policy.reason, cancellationPolicy.explain(policy));
    err.policy = policy;
    throw err;
  }

  const start = newStartTime instanceof Date ? newStartTime : new Date(newStartTime);
  const patientAge = availability.ageFromBirthDate(appointment.patient.birthDate);
  const check = await availability.checkSlot({
    doctorId: appointment.doctorId,
    serviceId: appointment.serviceId,
    startTime: start,
    patientAge,
    ignoreAppointmentId: appointment.id,
  });
  if (!check.ok) throw new BookingError(check.reason, 'Yangi vaqtga ko\'chirib bo\'lmadi');

  try {
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        startTime: start,
        endTime: check.endTime,
        roomId: check.roomId,
        status: 'CONFIRMED',
        // eslatmalar yangi vaqt uchun qaytadan yuborilsin
        dayBeforeReminderSentAt: null,
        hourBeforeReminderSentAt: null,
        patientConfirmedAt: null,
      },
      include: { doctor: true, service: true, room: true, patient: true },
    });

    notificationService.onAppointmentCreated(updated.id).catch(() => {});
    return updated;
  } catch (e) {
    if (e.code === 'P2002') throw new BookingError('SLOT_TAKEN', 'Bu vaqt hozirgina band bo\'ldi');
    throw e;
  }
}

/** "Yo'ldaman" belgisini qo'yish. */
async function markOnTheWay(appointmentId) {
  const appointment = await prisma.appointment.findUnique({ where: { id: Number(appointmentId) } });
  if (!appointment) throw new BookingError('NOT_FOUND', 'Navbat topilmadi');
  if (appointment.status !== 'CONFIRMED') throw new BookingError('WRONG_STATUS', 'Navbat tasdiqlanmagan');

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { onTheWay: true, onTheWayAt: new Date() },
  });
  notificationService.onPatientOnTheWay(updated.id).catch(() => {});
  return updated;
}

/** Davolash kursi: bo'sh vaqtlarga qarab barcha seanslarni band qilish. */
async function createCourse({ patientId, doctorId, serviceId, startDate }) {
  const service = await prisma.service.findUnique({ where: { id: Number(serviceId) } });
  if (!service || !service.isCourse) throw new BookingError('NOT_A_COURSE', 'Bu xizmat kurs emas');

  const course = await prisma.treatmentCourse.create({
    data: {
      patientId: Number(patientId),
      doctorId: Number(doctorId),
      serviceId: service.id,
      sessionCount: service.sessionCount,
      intervalDays: service.sessionIntervalDays,
      startDate: new Date(startDate),
    },
  });

  const created = [];
  let cursorDate = time.dateKey(new Date(startDate));

  for (let session = 1; session <= service.sessionCount; session++) {
    const { slots } = await availability.getAvailableSlots({
      doctorId, serviceId: service.id, dateFrom: cursorDate, dateTo: cursorDate, limit: 1,
    });
    if (slots.length === 0) {
      // Shu kunda joy bo'lmasa, keyingi kunlardan qidiriladi
      const horizon = time.dateRange(cursorDate, 7);
      const { slots: next } = await availability.getAvailableSlots({
        doctorId, serviceId: service.id,
        dateFrom: horizon[0], dateTo: horizon[horizon.length - 1], limit: 1,
      });
      if (next.length === 0) break;
      slots.push(next[0]);
    }
    const slot = slots[0];
    try {
      const { appointment } = await createAppointment({
        patientId, doctorId, serviceId: service.id,
        startTime: slot.startUtc, source: 'ADMIN',
        courseId: course.id, sessionNumber: session,
        skipPatientChecks: true,
      });
      created.push(appointment);
      cursorDate = time.dateKey(
        new Date(slot.startUtc.getTime() + service.sessionIntervalDays * 86400000),
      );
    } catch (e) {
      logger.warn('Kurs seansini band qilib bo\'lmadi', { session, code: e.code });
      break;
    }
  }

  return { course, appointments: created };
}

module.exports = {
  BookingError,
  findOrCreatePatient,
  createFamilyMember,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  markOnTheWay,
  createCourse,
  detectVisitType,
  assertPatientAllowed,
};
