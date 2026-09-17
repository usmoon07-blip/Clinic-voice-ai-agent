'use strict';
/** Client API — Telegram Mini App uchun. */
const { prisma } = require('../database/connection');
const availability = require('../services/availabilityService');
const bookingService = require('../services/bookingService');
const cancellationPolicy = require('../services/cancellationPolicyService');
const waitlistService = require('../services/waitlistService');
const settingsService = require('../services/settingsService');
const triage = require('../services/triageService');
const time = require('../utils/time');
const phoneUtil = require('../utils/phone');

const ok = (res, data) => res.json({ success: true, data, error: null });

/** Bemor va uning oila a'zolari ID lari. */
async function ownedPatientIds(patient) {
  const family = await prisma.patient.findMany({
    where: { guardianId: patient.id },
    select: { id: true },
  });
  return [patient.id, ...family.map((f) => f.id)];
}

async function assertOwnsAppointment(patient, appointmentId) {
  const ids = await ownedPatientIds(patient);
  const appointment = await prisma.appointment.findUnique({
    where: { id: Number(appointmentId) },
  });
  if (!appointment || !ids.includes(appointment.patientId)) {
    const err = new Error('Navbat topilmadi');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return appointment;
}

// ── Ma'lumotnoma ────────────────────────────────────────────

async function getClinicInfo(req, res) {
  const s = await settingsService.getSettings();
  return ok(res, {
    name: s.clinicName,
    phone: s.phone,
    address: s.address,
    landmark: s.landmark,
    latitude: s.latitude,
    longitude: s.longitude,
    workingHours: s.workingHoursText,
    emergencyPhone: s.emergencyPhone,
    cancellationWindowMinutes: s.cancellationWindowMinutes,
  });
}

async function listSpecialties(req, res) {
  const specialties = await prisma.specialty.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { doctors: true } } },
  });
  return ok(res, specialties);
}

async function listServices(req, res) {
  const { specialtyId, category } = req.query;
  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      ...(specialtyId ? { specialtyId: Number(specialtyId) } : {}),
      ...(category ? { category } : {}),
    },
    include: { specialty: true },
    orderBy: [{ category: 'asc' }, { nameUz: 'asc' }],
  });
  return ok(res, services);
}

async function getService(req, res) {
  const service = await prisma.service.findUnique({
    where: { id: Number(req.params.id) },
    include: { specialty: true, doctors: { where: { isActive: true } } },
  });
  if (!service) {
    return res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Xizmat topilmadi' } });
  }
  return ok(res, service);
}

/** Shikoyat matni bo'yicha mutaxassislikni topish (marshrutlash, tashxis emas). */
async function routeComplaint(req, res) {
  const { text, age } = req.body || {};
  const emergency = triage.detectEmergency(text);
  if (emergency.isEmergency) {
    const s = await settingsService.getSettings();
    return ok(res, {
      emergency: true,
      emergencyPhone: s.emergencyPhone,
      messageUz: `Bu holat shoshilinch yordam talab qilishi mumkin. Iltimos, hoziroq ${s.emergencyPhone} ga qo'ng'iroq qiling.`,
      messageRu: `Это может требовать неотложной помощи. Пожалуйста, немедленно позвоните ${s.emergencyPhone}.`,
      specialty: null,
    });
  }
  const routed = await triage.routeToSpecialty(text, age === undefined ? null : Number(age));
  return ok(res, { emergency: false, ...routed });
}

async function listDoctors(req, res) {
  const { specialtyId, serviceId, gender } = req.query;
  const doctors = await prisma.doctor.findMany({
    where: {
      isActive: true,
      calendarStatus: 'OPEN', // kalendari yopiq shifokor bemorga ko'rsatilmaydi
      ...(specialtyId ? { specialtyId: Number(specialtyId) } : {}),
      ...(gender ? { gender } : {}),
      ...(serviceId ? { services: { some: { id: Number(serviceId) } } } : {}),
    },
    include: { specialty: true },
    orderBy: { experienceYears: 'desc' },
  });

  const withRating = await Promise.all(
    doctors.map(async (d) => {
      const agg = await prisma.review.aggregate({
        where: { appointment: { doctorId: d.id }, isPublished: true },
        _avg: { rating: true },
        _count: true,
      });
      return { ...d, rating: agg._avg.rating, reviewCount: agg._count };
    }),
  );
  return ok(res, withRating);
}

async function getDoctor(req, res) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: Number(req.params.id) },
    include: { specialty: true, services: { where: { isActive: true } }, workingHours: true },
  });
  if (!doctor) {
    return res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Shifokor topilmadi' } });
  }
  return ok(res, doctor);
}

// ── Bandlik ─────────────────────────────────────────────────

function resolvePatientAge(req) {
  if (req.query.patientId) return null; // pastda aniqlanadi
  if (req.query.age !== undefined) return Number(req.query.age);
  return null;
}

async function getAvailableDates(req, res) {
  const { serviceId, doctorId, specialtyId, gender, days, patientId } = req.query;
  let age = resolvePatientAge(req);
  if (patientId) {
    const p = await prisma.patient.findUnique({ where: { id: Number(patientId) } });
    age = availability.ageFromBirthDate(p?.birthDate);
  }
  const dates = await availability.getAvailableDates({
    serviceId: Number(serviceId),
    doctorId: doctorId ? Number(doctorId) : undefined,
    specialtyId: specialtyId ? Number(specialtyId) : undefined,
    doctorGender: gender || undefined,
    days: days ? Number(days) : 30,
    patientAge: age,
  });
  return ok(res, dates);
}

async function getAvailableSlots(req, res) {
  const { serviceId, doctorId, specialtyId, gender, date, dateTo, patientId } = req.query;
  let age = resolvePatientAge(req);
  if (patientId) {
    const p = await prisma.patient.findUnique({ where: { id: Number(patientId) } });
    age = availability.ageFromBirthDate(p?.birthDate);
  }
  const result = await availability.getAvailableSlots({
    serviceId: Number(serviceId),
    doctorId: doctorId ? Number(doctorId) : undefined,
    specialtyId: specialtyId ? Number(specialtyId) : undefined,
    doctorGender: gender || undefined,
    dateFrom: date || time.dateKey(new Date()),
    dateTo: dateTo || date,
    patientAge: age,
    limit: 200,
  });
  return ok(res, result);
}

// ── Profil va oila ──────────────────────────────────────────

async function getProfile(req, res) {
  if (!req.patient) return ok(res, null);
  const patient = await prisma.patient.findUnique({
    where: { id: req.patient.id },
    include: { familyMembers: true },
  });
  return ok(res, patient);
}

async function upsertProfile(req, res) {
  const { firstName, lastName, phone, birthDate, gender, language, discreetMode } = req.body || {};
  const tgId = String(req.telegramUser.id);

  if (req.patient) {
    const updated = await prisma.patient.update({
      where: { id: req.patient.id },
      data: {
        firstName: firstName ?? req.patient.firstName,
        lastName: lastName ?? req.patient.lastName,
        birthDate: birthDate ? new Date(birthDate) : req.patient.birthDate,
        gender: gender ?? req.patient.gender,
        language: language ?? req.patient.language,
        discreetMode: discreetMode === undefined ? req.patient.discreetMode : Boolean(discreetMode),
      },
      include: { familyMembers: true },
    });
    return ok(res, updated);
  }

  if (!phoneUtil.isValid(phone)) {
    const err = new Error('Telefon raqami noto\'g\'ri');
    err.code = 'BAD_PHONE';
    throw err;
  }

  const patient = await bookingService.findOrCreatePatient({
    phone,
    firstName: firstName || req.telegramUser.first_name || 'Bemor',
    lastName: lastName || req.telegramUser.last_name || null,
    birthDate,
    gender,
    telegramId: tgId,
    source: 'TELEGRAM',
    language: language || 'UZ',
  });
  return ok(res, patient);
}

async function addFamilyMember(req, res) {
  const { firstName, lastName, birthDate, gender, relation } = req.body || {};
  const member = await bookingService.createFamilyMember({
    guardianId: req.patient.id,
    firstName, lastName, birthDate, gender, relation: relation || 'CHILD',
  });
  return ok(res, member);
}

// ── Navbatlar ───────────────────────────────────────────────

async function createAppointment(req, res) {
  const { doctorId, serviceId, startTime, patientId, note, idempotencyKey } = req.body || {};

  let targetPatientId = req.patient.id;
  if (patientId && Number(patientId) !== req.patient.id) {
    const ids = await ownedPatientIds(req.patient);
    if (!ids.includes(Number(patientId))) {
      const err = new Error('Bu bemor sizga bog\'lanmagan');
      err.code = 'FORBIDDEN';
      throw err;
    }
    targetPatientId = Number(patientId);
  }

  const { appointment, duplicate } = await bookingService.createAppointment({
    patientId: targetPatientId,
    doctorId: Number(doctorId),
    serviceId: Number(serviceId),
    startTime: new Date(startTime),
    source: 'TELEGRAM',
    patientNote: note || null,
    idempotencyKey: idempotencyKey || null,
  });
  return res.status(duplicate ? 200 : 201).json({ success: true, data: appointment, error: null });
}

async function listMyAppointments(req, res) {
  const ids = await ownedPatientIds(req.patient);
  const appointments = await prisma.appointment.findMany({
    where: { patientId: { in: ids } },
    include: { doctor: { include: { specialty: true } }, service: true, room: true, patient: true, review: true },
    orderBy: { startTime: 'desc' },
    take: 100,
  });

  const settings = await settingsService.getSettings();
  const enriched = appointments.map((a) => {
    const minutesLeft = Math.floor((new Date(a.startTime).getTime() - Date.now()) / 60000);
    return {
      ...a,
      canCancel: ['PENDING', 'CONFIRMED'].includes(a.status) && minutesLeft >= settings.cancellationWindowMinutes,
      canShowOnTheWay: a.status === 'CONFIRMED' && minutesLeft <= 60 && minutesLeft > -15 && !a.onTheWay,
      minutesLeft,
    };
  });
  return ok(res, enriched);
}

async function cancelAppointment(req, res) {
  const appointment = await assertOwnsAppointment(req.patient, req.params.id);
  const updated = await bookingService.cancelAppointment({
    appointmentId: appointment.id,
    actor: 'PATIENT',
    reason: req.body?.reason || null,
  });
  return ok(res, updated);
}

async function rescheduleAppointment(req, res) {
  const appointment = await assertOwnsAppointment(req.patient, req.params.id);
  const updated = await bookingService.rescheduleAppointment({
    appointmentId: appointment.id,
    newStartTime: new Date(req.body.startTime),
    actor: 'PATIENT',
  });
  return ok(res, updated);
}

async function markOnTheWay(req, res) {
  const appointment = await assertOwnsAppointment(req.patient, req.params.id);
  const updated = await bookingService.markOnTheWay(appointment.id);
  return ok(res, updated);
}

async function checkCancellation(req, res) {
  const appointment = await assertOwnsAppointment(req.patient, req.params.id);
  const result = await cancellationPolicy.canCancel(appointment, { actor: 'PATIENT' });
  return ok(res, {
    ...result,
    message: result.allowed ? null : cancellationPolicy.explain(result, req.patient.language || 'UZ'),
  });
}

// ── Kutish ro'yxati va baho ─────────────────────────────────

async function joinWaitlist(req, res) {
  const { serviceId, specialtyId, doctorId, dateFrom, dateTo, partOfDay } = req.body || {};
  const entry = await waitlistService.add({
    patientId: req.patient.id,
    serviceId, specialtyId, doctorId,
    dateFrom: dateFrom || new Date(),
    dateTo: dateTo || new Date(Date.now() + 14 * 86400000),
    preferredPartOfDay: partOfDay || 'any',
  });
  return res.status(201).json({ success: true, data: entry, error: null });
}

async function acceptWaitlistOffer(req, res) {
  const appointment = await waitlistService.acceptOffer(Number(req.params.id));
  return ok(res, appointment);
}

async function createReview(req, res) {
  const appointment = await assertOwnsAppointment(req.patient, req.body.appointmentId);
  if (appointment.status !== 'COMPLETED') {
    const err = new Error('Baho faqat yakunlangan qabuldan keyin qoldiriladi');
    err.code = 'WRONG_STATUS';
    throw err;
  }
  const review = await prisma.review.upsert({
    where: { appointmentId: appointment.id },
    update: { rating: Number(req.body.rating), comment: req.body.comment || null },
    create: {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      rating: Number(req.body.rating),
      comment: req.body.comment || null,
    },
  });
  return ok(res, review);
}

module.exports = {
  getClinicInfo,
  listSpecialties,
  listServices,
  getService,
  routeComplaint,
  listDoctors,
  getDoctor,
  getAvailableDates,
  getAvailableSlots,
  getProfile,
  upsertProfile,
  addFamilyMember,
  createAppointment,
  listMyAppointments,
  cancelAppointment,
  rescheduleAppointment,
  markOnTheWay,
  checkCancellation,
  joinWaitlist,
  acceptWaitlistOffer,
  createReview,
};
