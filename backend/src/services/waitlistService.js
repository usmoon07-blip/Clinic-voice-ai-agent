'use strict';
/**
 * Kutish ro'yxati: bemor xohlagan vaqt band bo'lsa, joy bo'shaganda avtomatik taklif qilinadi.
 * Taklif 30 daqiqa amal qiladi, javob bo'lmasa keyingi bemorga o'tadi.
 */
const { prisma } = require('../database/connection');
const availability = require('./availabilityService');
const notificationService = require('./notificationService');
const messages = require('../config/messages');
const config = require('../config/default');
const time = require('../utils/time');
const logger = require('../utils/logger');

/** Kutish ro'yxatiga qo'shish. */
async function add({ patientId, serviceId = null, specialtyId = null, doctorId = null, dateFrom, dateTo, preferredPartOfDay = 'any' }) {
  return prisma.waitlist.create({
    data: {
      patientId: Number(patientId),
      serviceId: serviceId ? Number(serviceId) : null,
      specialtyId: specialtyId ? Number(specialtyId) : null,
      doctorId: doctorId ? Number(doctorId) : null,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      preferredPartOfDay,
    },
    include: { patient: true, service: true, doctor: true },
  });
}

function partOfDayMatches(slotDate, preference) {
  if (!preference || preference === 'any') return true;
  const hour = time.toTashkent(slotDate).hour;
  if (preference === 'morning') return hour < 13;
  if (preference === 'afternoon') return hour >= 13;
  return true;
}

/**
 * Navbat bekor qilinganda bo'shagan vaqtni kutish ro'yxatidagi mos bemorga taklif qilish.
 * @param {Object} freedAppointment  bekor qilingan navbat
 */
async function offerFreedSlot(freedAppointment) {
  const appt = await prisma.appointment.findUnique({
    where: { id: freedAppointment.id },
    include: { doctor: true, service: true },
  });
  if (!appt) return null;

  const candidates = await prisma.waitlist.findMany({
    where: {
      status: 'WAITING',
      dateFrom: { lte: appt.startTime },
      dateTo: { gte: appt.startTime },
      OR: [
        { serviceId: appt.serviceId },
        { specialtyId: appt.doctor.specialtyId },
      ],
    },
    include: { patient: true },
    orderBy: { createdAt: 'asc' },
  });

  const match = candidates.find(
    (c) =>
      (!c.doctorId || c.doctorId === appt.doctorId) &&
      partOfDayMatches(appt.startTime, c.preferredPartOfDay),
  );
  if (!match) return null;

  return offerTo(match, appt);
}

/** Aniq bir kutish yozuviga taklif yuborish. */
async function offerTo(entry, appointmentLikeSlot) {
  const minutes = config.booking.waitlistOfferMinutes;
  const expires = new Date(Date.now() + minutes * 60000);

  const updated = await prisma.waitlist.update({
    where: { id: entry.id },
    data: { status: 'OFFERED', offeredSlot: appointmentLikeSlot.startTime, offerExpiresAt: expires },
    include: { patient: true },
  });

  const doctor = appointmentLikeSlot.doctor
    || (await prisma.doctor.findUnique({ where: { id: appointmentLikeSlot.doctorId } }));
  const lang = updated.patient.language || 'UZ';
  const link = config.telegram.miniAppUrl
    ? `${config.telegram.miniAppUrl}/waitlist/${updated.id}`
    : config.publicUrl;

  const text = messages.waitlistOffer({
    doctor, slot: appointmentLikeSlot.startTime, minutes, link, lang,
  });

  await notificationService.notifyPatient(updated.patient, { telegramText: text, smsText: text });
  logger.info('Kutish ro\'yxati taklifi yuborildi', { waitlistId: updated.id });
  return updated;
}

/** Muddati o'tgan takliflarni bo'shatish va keyingi bemorga uzatish. */
async function expireOffers() {
  const expired = await prisma.waitlist.findMany({
    where: { status: 'OFFERED', offerExpiresAt: { lt: new Date() } },
  });

  for (const entry of expired) {
    await prisma.waitlist.update({
      where: { id: entry.id },
      data: { status: 'WAITING', offeredSlot: null, offerExpiresAt: null },
    });
  }
  return expired.length;
}

/**
 * Kutish ro'yxatidagi bemorlarni davriy tekshirish:
 * ularning oralig'ida bo'sh joy paydo bo'lgan bo'lsa, taklif yuborish.
 */
async function scanForOpenings({ limit = 20 } = {}) {
  const waiting = await prisma.waitlist.findMany({
    where: { status: 'WAITING', dateTo: { gte: new Date() } },
    include: { patient: true, service: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let offered = 0;
  for (const entry of waiting) {
    if (!entry.serviceId) continue;
    const patientAge = availability.ageFromBirthDate(entry.patient.birthDate);
    const { slots } = await availability.getAvailableSlots({
      serviceId: entry.serviceId,
      doctorId: entry.doctorId || undefined,
      specialtyId: entry.specialtyId || undefined,
      dateFrom: time.dateKey(entry.dateFrom < new Date() ? new Date() : entry.dateFrom),
      dateTo: time.dateKey(entry.dateTo),
      patientAge,
      limit: 20,
    });
    const slot = slots.find((s) => partOfDayMatches(s.startUtc, entry.preferredPartOfDay));
    if (!slot) continue;

    const doctor = await prisma.doctor.findUnique({ where: { id: slot.doctorId } });
    await offerTo(entry, { startTime: slot.startUtc, doctorId: slot.doctorId, doctor });
    offered += 1;
  }
  return offered;
}

/** Taklifni qabul qilish -> navbat yaratish. */
async function acceptOffer(waitlistId) {
  // eslint-disable-next-line global-require
  const bookingService = require('./bookingService');
  const entry = await prisma.waitlist.findUnique({
    where: { id: Number(waitlistId) },
    include: { patient: true },
  });
  if (!entry) throw new Error('WAITLIST_NOT_FOUND');
  if (entry.status !== 'OFFERED' || !entry.offeredSlot) throw new Error('NO_ACTIVE_OFFER');
  if (entry.offerExpiresAt && entry.offerExpiresAt < new Date()) throw new Error('OFFER_EXPIRED');

  const { slots } = await availability.getAvailableSlots({
    serviceId: entry.serviceId,
    doctorId: entry.doctorId || undefined,
    dateFrom: time.dateKey(entry.offeredSlot),
    dateTo: time.dateKey(entry.offeredSlot),
    limit: 200,
  });
  const slot = slots.find((s) => s.startUtc.getTime() === new Date(entry.offeredSlot).getTime());
  if (!slot) {
    await prisma.waitlist.update({ where: { id: entry.id }, data: { status: 'WAITING', offeredSlot: null } });
    throw new Error('SLOT_TAKEN');
  }

  const { appointment } = await bookingService.createAppointment({
    patientId: entry.patientId,
    doctorId: slot.doctorId,
    serviceId: entry.serviceId,
    startTime: slot.startUtc,
    source: 'TELEGRAM',
  });

  await prisma.waitlist.update({ where: { id: entry.id }, data: { status: 'BOOKED' } });
  return appointment;
}

module.exports = { add, offerFreedSlot, offerTo, expireOffers, scanForOpenings, acceptOffer };
