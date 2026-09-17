'use strict';
/**
 * BO'SH VAQTNI HISOBLASHNING YAGONA MANBASI.
 *
 * Mini App ham, AI Voice Agent ham, Admin panel ham FAQAT shu servisni chaqiradi.
 * Shunda telefon orqali va ilova orqali olingan navbatlar hech qachon to'qnashmaydi.
 *
 * Hisobga olinadi:
 *  - shifokorning ish vaqti va tanaffusi
 *  - kalendar holati (YOPIQ = umuman slot yo'q)
 *  - jadval istisnolari (ta'til, bayram, qo'shimcha ish kuni)
 *  - xizmat davomiyligi va qabullar orasidagi bufer
 *  - kabinet/uskuna bandligi
 *  - mavjud navbatlar (interval kesishuvi bo'yicha)
 *  - o'tgan vaqt va minimal oldindan yozilish vaqti
 *  - bemor yoshi va xizmatning yosh chegarasi
 */
const { prisma } = require('../database/connection');
const settingsService = require('./settingsService');
const time = require('../utils/time');
const config = require('../config/default');

// Bu statuslar vaqtni band qiladi
const BLOCKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'];

/** Ikki interval kesishadimi? */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Bemor yoshi (yilda). Tug'ilgan sana bo'lmasa null. */
function ageFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const birth = time.toTashkent(birthDate);
  return Math.floor(time.now().diff(birth, 'years').years);
}

/** Xizmat va shifokor yosh chegarasiga mos keladimi? */
function ageFits(age, min, max) {
  if (age === null || age === undefined) return true; // yosh noma'lum bo'lsa cheklamaymiz
  return age >= (min ?? 0) && age <= (max ?? 120);
}

/**
 * Berilgan kun uchun shifokorning ish oynalarini qaytaradi.
 * @returns {Array<{start: number, end: number}>} yarim tundan boshlab daqiqalarda
 */
function workWindowsForDay({ workingHour, exception }) {
  if (exception) {
    if (['DAY_OFF', 'VACATION', 'HOLIDAY'].includes(exception.type)) return [];
    if (exception.type === 'EXTRA_WORKING_DAY') {
      const start = time.hhmmToMinutes(exception.startTime || '09:00');
      const end = time.hhmmToMinutes(exception.endTime || '17:00');
      return end > start ? [{ start, end }] : [];
    }
  }
  if (!workingHour || !workingHour.isWorking) return [];

  const start = time.hhmmToMinutes(workingHour.startTime);
  const end = time.hhmmToMinutes(workingHour.endTime);
  if (end <= start) return [];

  // Tanaffus ish oynasini ikkiga bo'ladi
  if (workingHour.breakStart && workingHour.breakEnd) {
    const bStart = time.hhmmToMinutes(workingHour.breakStart);
    const bEnd = time.hhmmToMinutes(workingHour.breakEnd);
    if (bStart > start && bEnd < end) {
      return [{ start, end: bStart }, { start: bEnd, end }];
    }
    if (bStart <= start && bEnd > start) return [{ start: bEnd, end }];
    if (bEnd >= end && bStart < end) return [{ start, end: bStart }];
  }
  return [{ start, end }];
}

/** Shifokorlarni filtrlash uchun where sharti. */
function doctorWhere({ doctorId, specialtyId, gender, serviceId }) {
  const where = { isActive: true, calendarStatus: 'OPEN' };
  if (doctorId) where.id = Number(doctorId);
  if (specialtyId) where.specialtyId = Number(specialtyId);
  if (gender) where.gender = gender;
  if (serviceId) where.services = { some: { id: Number(serviceId) } };
  return where;
}

/**
 * Bo'sh vaqtlarni hisoblash.
 *
 * @param {Object} params
 * @param {number} [params.doctorId]
 * @param {number} params.serviceId
 * @param {number} [params.specialtyId]
 * @param {'MALE'|'FEMALE'} [params.doctorGender]
 * @param {string} params.dateFrom  "2026-09-18" (Toshkent)
 * @param {string} [params.dateTo]
 * @param {number} [params.patientAge]
 * @param {number} [params.limit]
 * @returns {Promise<Array>} slotlar
 */
async function getAvailableSlots({
  doctorId,
  serviceId,
  specialtyId,
  doctorGender,
  dateFrom,
  dateTo,
  patientAge = null,
  limit = 100,
}) {
  const settings = await settingsService.getSettings();

  const service = await prisma.service.findUnique({
    where: { id: Number(serviceId) },
    include: { specialty: true },
  });
  if (!service || !service.isActive) {
    return { slots: [], reason: 'SERVICE_NOT_FOUND' };
  }
  if (!ageFits(patientAge, service.minAge, service.maxAge)) {
    return { slots: [], reason: 'AGE_NOT_ALLOWED' };
  }

  const doctors = await prisma.doctor.findMany({
    where: doctorWhere({
      doctorId,
      specialtyId: specialtyId || service.specialtyId,
      gender: doctorGender,
      serviceId: service.id,
    }),
    include: { workingHours: true, specialty: true },
  });
  const eligibleDoctors = doctors.filter((d) => ageFits(patientAge, d.minAge, d.maxAge));
  if (eligibleDoctors.length === 0) return { slots: [], reason: 'NO_DOCTOR' };

  const startDate = dateFrom || time.dateKey(new Date());
  const days = dateTo
    ? Math.min(
        Math.round(
          (time.startOfDayUtc(dateTo) - time.startOfDayUtc(startDate)) / 86400000,
        ) + 1,
        config.booking.searchHorizonDays,
      )
    : 1;
  const dates = time.dateRange(startDate, Math.max(days, 1));

  const rangeStart = time.startOfDayUtc(dates[0]);
  const rangeEnd = time.endOfDayUtc(dates[dates.length - 1]);

  const doctorIds = eligibleDoctors.map((d) => d.id);

  const [exceptions, appointments, rooms] = await Promise.all([
    prisma.scheduleException.findMany({
      where: { doctorId: { in: doctorIds }, date: { gte: rangeStart, lt: rangeEnd } },
    }),
    prisma.appointment.findMany({
      where: {
        startTime: { gte: rangeStart, lt: rangeEnd },
        status: { in: BLOCKING_STATUSES },
      },
      select: { doctorId: true, roomId: true, startTime: true, endTime: true },
    }),
    prisma.room.findMany({
      where: { isActive: true, ...(service.requiredRoomType ? { type: service.requiredRoomType } : {}) },
    }),
  ]);

  // Xizmat kabinet talab qilsa, lekin mos kabinet bo'lmasa
  const usableRooms = rooms.length
    ? rooms
    : await prisma.room.findMany({ where: { isActive: true, type: 'CONSULTATION' } });
  if (usableRooms.length === 0) return { slots: [], reason: 'NO_ROOM' };

  const duration = service.durationMinutes;
  const step = duration + (settings.appointmentBufferMinutes || 0);
  const earliest = time.now().plus({ minutes: settings.minLeadTimeMinutes || 0 }).toJSDate();

  const slots = [];

  for (const date of dates) {
    const dow = time.isoDayOfWeek(date);
    const dayStartUtc = time.startOfDayUtc(date);

    for (const doctor of eligibleDoctors) {
      const workingHour = doctor.workingHours.find((wh) => wh.dayOfWeek === dow);
      const exception = exceptions.find(
        (ex) => ex.doctorId === doctor.id && time.dateKey(ex.date) === date,
      );
      const windows = workWindowsForDay({ workingHour, exception });
      if (windows.length === 0) continue;

      for (const win of windows) {
        for (let minute = win.start; minute + duration <= win.end; minute += step) {
          const startUtc = time.toUtc(date, time.minutesToHhmm(minute));
          const endUtc = new Date(startUtc.getTime() + duration * 60000);

          if (startUtc < earliest) continue;

          const doctorBusy = appointments.some(
            (a) => a.doctorId === doctor.id && overlaps(startUtc, endUtc, a.startTime, a.endTime),
          );
          if (doctorBusy) continue;

          const freeRoom = usableRooms.find(
            (room) =>
              !appointments.some(
                (a) => a.roomId === room.id && overlaps(startUtc, endUtc, a.startTime, a.endTime),
              ),
          );
          if (!freeRoom) continue;

          slots.push({
            date,
            time: time.minutesToHhmm(minute),
            startUtc,
            endUtc,
            doctorId: doctor.id,
            doctorName: `${doctor.firstName} ${doctor.lastName}`,
            doctorGender: doctor.gender,
            specialtyId: doctor.specialtyId,
            specialtyNameUz: doctor.specialty?.nameUz,
            specialtyNameRu: doctor.specialty?.nameRu,
            serviceId: service.id,
            serviceNameUz: service.nameUz,
            serviceNameRu: service.nameRu,
            durationMinutes: duration,
            price: service.price,
            roomId: freeRoom.id,
            roomName: freeRoom.name,
          });

          if (slots.length >= limit) {
            slots.sort((a, b) => a.startUtc - b.startUtc);
            return { slots, reason: null };
          }
        }
      }
    }
  }

  slots.sort((a, b) => a.startUtc - b.startUtc);
  return { slots, reason: slots.length ? null : 'NO_SLOTS' };
}

/**
 * Bitta aniq vaqt hali ham bo'shmi? Navbat yaratishdan OLDIN qayta tekshiriladi.
 * @returns {Promise<{ok: boolean, roomId?: number, reason?: string, endTime?: Date}>}
 */
async function checkSlot({ doctorId, serviceId, startTime, patientAge = null, ignoreAppointmentId = null }) {
  const settings = await settingsService.getSettings();
  const service = await prisma.service.findUnique({ where: { id: Number(serviceId) } });
  if (!service || !service.isActive) return { ok: false, reason: 'SERVICE_NOT_FOUND' };

  const doctor = await prisma.doctor.findUnique({
    where: { id: Number(doctorId) },
    include: { workingHours: true, services: { select: { id: true } } },
  });
  if (!doctor || !doctor.isActive) return { ok: false, reason: 'DOCTOR_NOT_FOUND' };
  if (doctor.calendarStatus === 'CLOSED') return { ok: false, reason: 'CALENDAR_CLOSED' };
  if (!doctor.services.some((s) => s.id === service.id)) return { ok: false, reason: 'SERVICE_NOT_PROVIDED' };
  if (!ageFits(patientAge, service.minAge, service.maxAge)) return { ok: false, reason: 'AGE_NOT_ALLOWED' };
  if (!ageFits(patientAge, doctor.minAge, doctor.maxAge)) return { ok: false, reason: 'AGE_NOT_ALLOWED' };

  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = new Date(start.getTime() + service.durationMinutes * 60000);

  const earliest = time.now().plus({ minutes: settings.minLeadTimeMinutes || 0 }).toJSDate();
  if (start < earliest) return { ok: false, reason: 'TOO_LATE' };

  const date = time.dateKey(start);
  const dow = time.isoDayOfWeek(date);
  const workingHour = doctor.workingHours.find((wh) => wh.dayOfWeek === dow);
  const exception = await prisma.scheduleException.findFirst({
    where: { doctorId: doctor.id, date: time.startOfDayUtc(date) },
  });
  const windows = workWindowsForDay({ workingHour, exception });
  const startMin = time.hhmmToMinutes(time.timeKey(start));
  const endMin = startMin + service.durationMinutes;
  const insideWindow = windows.some((w) => startMin >= w.start && endMin <= w.end);
  if (!insideWindow) return { ok: false, reason: 'OUTSIDE_WORKING_HOURS' };

  const conflicts = await prisma.appointment.findMany({
    where: {
      status: { in: BLOCKING_STATUSES },
      startTime: { lt: end },
      endTime: { gt: start },
      ...(ignoreAppointmentId ? { id: { not: Number(ignoreAppointmentId) } } : {}),
    },
    select: { doctorId: true, roomId: true },
  });

  if (conflicts.some((c) => c.doctorId === doctor.id)) return { ok: false, reason: 'DOCTOR_BUSY' };

  let rooms = await prisma.room.findMany({
    where: { isActive: true, ...(service.requiredRoomType ? { type: service.requiredRoomType } : {}) },
  });
  if (rooms.length === 0) {
    rooms = await prisma.room.findMany({ where: { isActive: true, type: 'CONSULTATION' } });
  }
  const busyRoomIds = new Set(conflicts.map((c) => c.roomId).filter(Boolean));
  const freeRoom = rooms.find((r) => !busyRoomIds.has(r.id));
  if (!freeRoom) return { ok: false, reason: 'NO_ROOM' };

  return { ok: true, roomId: freeRoom.id, endTime: end, price: service.price, service, doctor };
}

/** Qaysi kunlarda umuman bo'sh joy bor (Mini App kalendari uchun). */
async function getAvailableDates({ doctorId, serviceId, specialtyId, doctorGender, days = 30, patientAge = null }) {
  const from = time.dateKey(new Date());
  const to = time.dateRange(from, days)[days - 1];
  const { slots } = await getAvailableSlots({
    doctorId, serviceId, specialtyId, doctorGender,
    dateFrom: from, dateTo: to, patientAge, limit: 5000,
  });
  const set = new Set(slots.map((s) => s.date));
  return [...set].sort();
}

module.exports = {
  getAvailableSlots,
  getAvailableDates,
  checkSlot,
  ageFromBirthDate,
  workWindowsForDay,
  overlaps,
  ageFits,
  BLOCKING_STATUSES,
};
