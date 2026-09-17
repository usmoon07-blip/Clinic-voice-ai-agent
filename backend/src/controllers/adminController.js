'use strict';
/** Admin API — registratura, shifokorlar va administrator uchun. */
const bcrypt = require('bcryptjs');
const { prisma } = require('../database/connection');
const auth = require('../middlewares/auth.middleware');
const bookingService = require('../services/bookingService');
const availability = require('../services/availabilityService');
const notificationService = require('../services/notificationService');
const settingsService = require('../services/settingsService');
const auditService = require('../services/auditService');
const time = require('../utils/time');
const phoneUtil = require('../utils/phone');

const ok = (res, data) => res.json({ success: true, data, error: null });

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** DOCTOR roli faqat o'zining ma'lumotini ko'rishi uchun filtr. */
function doctorScope(req, extra = {}) {
  return req.forcedDoctorId ? { ...extra, doctorId: req.forcedDoctorId } : extra;
}

// ── Autentifikatsiya ────────────────────────────────────────

async function login(req, res) {
  const { login: userLogin, password } = req.body || {};
  const admin = await prisma.adminUser.findUnique({ where: { login: String(userLogin || '') } });

  if (!admin || !admin.isActive || !(await bcrypt.compare(String(password || ''), admin.passwordHash))) {
    await auditService.record({
      action: 'LOGIN_FAILED', entity: 'AdminUser', entityId: userLogin,
      ip: req.ip,
    });
    throw fail('BAD_CREDENTIALS', 'Login yoki parol noto\'g\'ri');
  }

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await auditService.record({ adminUserId: admin.id, action: 'LOGIN', entity: 'AdminUser', entityId: admin.id, ip: req.ip });

  return ok(res, {
    token: auth.sign(admin),
    user: { id: admin.id, login: admin.login, fullName: admin.fullName, role: admin.role, doctorId: admin.doctorId },
  });
}

async function me(req, res) {
  return ok(res, {
    id: req.admin.id, login: req.admin.login, fullName: req.admin.fullName,
    role: req.admin.role, doctorId: req.admin.doctorId,
  });
}

// ── Dashboard ───────────────────────────────────────────────

async function dashboard(req, res) {
  const todayKey = time.dateKey(new Date());
  const dayStart = time.startOfDayUtc(todayKey);
  const dayEnd = time.endOfDayUtc(todayKey);
  const scope = doctorScope(req);

  const [todayAppointments, pending, revenueAgg, totalPatients, activeDoctors, calls, callsBooked, noShowMonth, totalMonth] =
    await Promise.all([
      prisma.appointment.count({ where: { ...scope, startTime: { gte: dayStart, lt: dayEnd }, status: { notIn: ['CANCELLED'] } } }),
      prisma.appointment.count({ where: { ...scope, status: 'PENDING' } }),
      prisma.appointment.aggregate({
        where: { ...scope, startTime: { gte: dayStart, lt: dayEnd }, status: { in: ['COMPLETED', 'CHECKED_IN'] } },
        _sum: { price: true },
      }),
      prisma.patient.count(),
      prisma.doctor.count({ where: { isActive: true } }),
      prisma.callLog.count({ where: { startedAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.callLog.count({ where: { startedAt: { gte: dayStart, lt: dayEnd }, outcome: 'BOOKED' } }),
      prisma.appointment.count({ where: { ...scope, status: 'NO_SHOW', startTime: { gte: new Date(Date.now() - 30 * 86400000) } } }),
      prisma.appointment.count({ where: { ...scope, startTime: { gte: new Date(Date.now() - 30 * 86400000) }, status: { notIn: ['CANCELLED'] } } }),
    ]);

  const popularServices = await prisma.appointment.groupBy({
    by: ['serviceId'],
    where: { ...scope, startTime: { gte: new Date(Date.now() - 30 * 86400000) } },
    _count: { serviceId: true },
    orderBy: { _count: { serviceId: 'desc' } },
    take: 5,
  });
  const serviceNames = await prisma.service.findMany({
    where: { id: { in: popularServices.map((p) => p.serviceId) } },
    select: { id: true, nameUz: true, nameRu: true },
  });

  const latencyAgg = await prisma.callLog.aggregate({
    where: { startedAt: { gte: dayStart, lt: dayEnd }, avgLatencyMs: { not: null } },
    _avg: { avgLatencyMs: true },
  });
  const escalated = await prisma.callLog.count({
    where: { startedAt: { gte: dayStart, lt: dayEnd }, outcome: { in: ['ESCALATED', 'EMERGENCY'] } },
  });

  return ok(res, {
    todayAppointments,
    pending,
    todayRevenue: revenueAgg._sum.price || 0,
    totalPatients,
    activeDoctors,
    calls: { total: calls, booked: callsBooked, escalated, conversion: calls ? Math.round((callsBooked / calls) * 100) : 0 },
    noShowRate: totalMonth ? Math.round((noShowMonth / totalMonth) * 100) : 0,
    avgVoiceLatencyMs: Math.round(latencyAgg._avg.avgLatencyMs || 0),
    popularServices: popularServices.map((p) => ({
      count: p._count.serviceId,
      service: serviceNames.find((s) => s.id === p.serviceId) || null,
    })),
  });
}

/** Band soatlar issiqlik xaritasi (hafta kuni x soat). */
async function heatmap(req, res) {
  const since = new Date(Date.now() - 60 * 86400000);
  const appointments = await prisma.appointment.findMany({
    where: { ...doctorScope(req), startTime: { gte: since } },
    select: { startTime: true },
  });
  const grid = {};
  for (const a of appointments) {
    const dt = time.toTashkent(a.startTime);
    const key = `${dt.weekday}-${dt.hour}`;
    grid[key] = (grid[key] || 0) + 1;
  }
  return ok(res, grid);
}

// ── Navbatlar ───────────────────────────────────────────────

async function listAppointments(req, res) {
  const { date, dateTo, status, doctorId, source, query, take = 200 } = req.query;
  const where = { ...doctorScope(req) };

  if (date) {
    where.startTime = { gte: time.startOfDayUtc(date), lt: time.endOfDayUtc(dateTo || date) };
  }
  if (status) where.status = status;
  if (source) where.source = source;
  if (doctorId && !req.forcedDoctorId) where.doctorId = Number(doctorId);
  if (query) {
    const phone = phoneUtil.normalize(query);
    where.patient = {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        ...(phone ? [{ phone: { contains: phone.slice(-7) } }] : []),
      ],
    };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: true,
      doctor: { include: { specialty: true } },
      service: true,
      room: true,
      callLog: { select: { id: true, outcome: true } },
    },
    orderBy: { startTime: 'asc' },
    take: Number(take),
  });
  return ok(res, appointments);
}

async function updateAppointmentStatus(req, res) {
  const { status } = req.body || {};
  const allowed = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
  if (!allowed.includes(status)) throw fail('VALIDATION', 'Status noto\'g\'ri');

  const before = await prisma.appointment.findUnique({ where: { id: Number(req.params.id) } });
  if (!before) throw fail('NOT_FOUND', 'Navbat topilmadi');
  if (req.forcedDoctorId && before.doctorId !== req.forcedDoctorId) throw fail('FORBIDDEN', 'Ruxsat yo\'q');

  if (status === 'CANCELLED') {
    const updated = await bookingService.cancelAppointment({
      appointmentId: before.id,
      actor: req.admin.role === 'DOCTOR' ? 'DOCTOR' : 'ADMIN',
      reason: req.body?.reason || null,
      byClinic: true,
    });
    await auditService.record({ ...auditService.fromRequest(req), action: 'UPDATE', entity: 'Appointment', entityId: before.id, oldValue: { status: before.status }, newValue: { status: 'CANCELLED' } });
    return ok(res, updated);
  }

  const updated = await prisma.appointment.update({
    where: { id: before.id },
    data: {
      status,
      ...(status === 'NO_SHOW' ? {} : {}),
    },
  });

  if (status === 'NO_SHOW' && before.status !== 'NO_SHOW') {
    await prisma.patient.update({
      where: { id: before.patientId },
      data: { noShowCount: { increment: 1 } },
    });
  }

  await auditService.record({ ...auditService.fromRequest(req), action: 'UPDATE', entity: 'Appointment', entityId: before.id, oldValue: { status: before.status }, newValue: { status } });
  return ok(res, updated);
}

async function rescheduleAppointment(req, res) {
  const updated = await bookingService.rescheduleAppointment({
    appointmentId: Number(req.params.id),
    newStartTime: new Date(req.body.startTime),
    actor: 'ADMIN',
  });
  await auditService.record({ ...auditService.fromRequest(req), action: 'UPDATE', entity: 'Appointment', entityId: updated.id, newValue: { startTime: updated.startTime } });
  return ok(res, updated);
}

/** Registratura qo'lda navbat yozadi (telefon orqali kelgan bemor uchun ham). */
async function createAppointment(req, res) {
  const { phone, firstName, lastName, birthDate, doctorId, serviceId, startTime, note } = req.body || {};
  const patient = await bookingService.findOrCreatePatient({
    phone, firstName, lastName, birthDate, source: 'ADMIN',
  });
  const { appointment } = await bookingService.createAppointment({
    patientId: patient.id,
    doctorId: Number(doctorId),
    serviceId: Number(serviceId),
    startTime: new Date(startTime),
    source: 'ADMIN',
    patientNote: note || null,
    skipPatientChecks: true,
  });
  await auditService.record({ ...auditService.fromRequest(req), action: 'CREATE', entity: 'Appointment', entityId: appointment.id });
  return res.status(201).json({ success: true, data: appointment, error: null });
}

async function getAvailableSlotsAdmin(req, res) {
  const result = await availability.getAvailableSlots({
    serviceId: Number(req.query.serviceId),
    doctorId: req.query.doctorId ? Number(req.query.doctorId) : undefined,
    dateFrom: req.query.date,
    dateTo: req.query.dateTo || req.query.date,
    limit: 500,
  });
  return ok(res, result);
}

// ── Shifokorlar ─────────────────────────────────────────────

async function listDoctors(req, res) {
  const doctors = await prisma.doctor.findMany({
    where: req.forcedDoctorId ? { id: req.forcedDoctorId } : {},
    include: { specialty: true, workingHours: true, services: { select: { id: true, nameUz: true } } },
    orderBy: { lastName: 'asc' },
  });
  return ok(res, doctors);
}

async function createDoctor(req, res) {
  const data = { ...req.body };
  const serviceIds = data.serviceIds || [];
  delete data.serviceIds;
  const doctor = await prisma.doctor.create({
    data: { ...data, specialtyId: Number(data.specialtyId), services: { connect: serviceIds.map((id) => ({ id: Number(id) })) } },
  });
  await auditService.record({ ...auditService.fromRequest(req), action: 'CREATE', entity: 'Doctor', entityId: doctor.id });
  return res.status(201).json({ success: true, data: doctor, error: null });
}

async function updateDoctor(req, res) {
  const id = Number(req.params.id);
  if (req.forcedDoctorId && req.forcedDoctorId !== id) throw fail('FORBIDDEN', 'Ruxsat yo\'q');
  const data = { ...req.body };
  const serviceIds = data.serviceIds;
  delete data.serviceIds;
  if (data.specialtyId) data.specialtyId = Number(data.specialtyId);

  const doctor = await prisma.doctor.update({
    where: { id },
    data: { ...data, ...(serviceIds ? { services: { set: serviceIds.map((s) => ({ id: Number(s) })) } } : {}) },
  });
  await auditService.record({ ...auditService.fromRequest(req), action: 'UPDATE', entity: 'Doctor', entityId: id, newValue: data });
  return ok(res, doctor);
}

/** Kalendarni ochish/yopish — yopiq bo'lsa yangi navbat berilmaydi. */
async function toggleCalendar(req, res) {
  const id = Number(req.params.id);
  if (req.forcedDoctorId && req.forcedDoctorId !== id) throw fail('FORBIDDEN', 'Ruxsat yo\'q');
  const doctor = await prisma.doctor.findUnique({ where: { id } });
  if (!doctor) throw fail('NOT_FOUND', 'Shifokor topilmadi');

  const next = doctor.calendarStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
  const updated = await prisma.doctor.update({
    where: { id },
    data: { calendarStatus: next, calendarClosedReason: next === 'CLOSED' ? (req.body?.reason || null) : null },
  });
  await auditService.record({ ...auditService.fromRequest(req), action: 'UPDATE', entity: 'Doctor', entityId: id, newValue: { calendarStatus: next } });
  return ok(res, updated);
}

/**
 * Kunni bekor qilish: shifokor kasal bo'lib qolganda barcha bemorlarga
 * avtomatik xabar yuboriladi (qo'lda qo'ng'iroq qilib o'tirilmaydi).
 */
async function cancelDoctorDay(req, res) {
  const id = Number(req.params.id);
  if (req.forcedDoctorId && req.forcedDoctorId !== id) throw fail('FORBIDDEN', 'Ruxsat yo\'q');
  const { date, reason } = req.body || {};
  if (!date) throw fail('VALIDATION', 'Sana ko\'rsatilmagan');

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: id,
      startTime: { gte: time.startOfDayUtc(date), lt: time.endOfDayUtc(date) },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
  });

  for (const appt of appointments) {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: 'CANCELLED', cancelledBy: 'DOCTOR', cancelReason: reason || 'Shifokor bandligi', cancelledAt: new Date() },
    });
    notificationService.onAppointmentCancelled(appt.id, { byClinic: true }).catch(() => {});
  }

  await prisma.scheduleException.upsert({
    where: { doctorId_date: { doctorId: id, date: time.startOfDayUtc(date) } },
    update: { type: 'DAY_OFF', note: reason || null },
    create: { doctorId: id, date: time.startOfDayUtc(date), type: 'DAY_OFF', note: reason || null },
  });

  await auditService.record({ ...auditService.fromRequest(req), action: 'UPDATE', entity: 'Doctor', entityId: id, newValue: { cancelledDay: date, count: appointments.length } });
  return ok(res, { cancelled: appointments.length });
}

// ── Xizmatlar, mutaxassisliklar, kabinetlar ─────────────────

async function listServices(req, res) {
  const services = await prisma.service.findMany({
    include: { specialty: true, doctors: { select: { id: true } } },
    orderBy: [{ category: 'asc' }, { nameUz: 'asc' }],
  });
  return ok(res, services);
}

async function upsertService(req, res) {
  const data = { ...req.body };
  const doctorIds = data.doctorIds;
  delete data.doctorIds;
  if (data.specialtyId) data.specialtyId = Number(data.specialtyId);
  ['price', 'oldPrice', 'durationMinutes', 'minAge', 'maxAge', 'sessionCount', 'sessionIntervalDays', 'prepReminderHours']
    .forEach((k) => { if (data[k] !== undefined && data[k] !== null) data[k] = Number(data[k]); });

  const id = req.params.id ? Number(req.params.id) : null;
  const service = id
    ? await prisma.service.update({
        where: { id },
        data: { ...data, ...(doctorIds ? { doctors: { set: doctorIds.map((d) => ({ id: Number(d) })) } } : {}) },
      })
    : await prisma.service.create({
        data: { ...data, ...(doctorIds ? { doctors: { connect: doctorIds.map((d) => ({ id: Number(d) })) } } : {}) },
      });

  await auditService.record({ ...auditService.fromRequest(req), action: id ? 'UPDATE' : 'CREATE', entity: 'Service', entityId: service.id });
  return ok(res, service);
}

async function deleteService(req, res) {
  const id = Number(req.params.id);
  // O'chirish o'rniga nofaol qilinadi — tarixiy navbatlar saqlanib qolsin
  const service = await prisma.service.update({ where: { id }, data: { isActive: false } });
  await auditService.record({ ...auditService.fromRequest(req), action: 'DELETE', entity: 'Service', entityId: id });
  return ok(res, service);
}

async function listSpecialties(req, res) {
  return ok(res, await prisma.specialty.findMany({ orderBy: { sortOrder: 'asc' } }));
}

async function upsertSpecialty(req, res) {
  const data = { ...req.body };
  if (typeof data.symptomAliases === 'string') {
    data.symptomAliases = data.symptomAliases.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const id = req.params.id ? Number(req.params.id) : null;
  const specialty = id
    ? await prisma.specialty.update({ where: { id }, data })
    : await prisma.specialty.create({ data });
  return ok(res, specialty);
}

async function listRooms(req, res) {
  return ok(res, await prisma.room.findMany({ orderBy: { name: 'asc' } }));
}

async function upsertRoom(req, res) {
  const id = req.params.id ? Number(req.params.id) : null;
  const room = id
    ? await prisma.room.update({ where: { id }, data: req.body })
    : await prisma.room.create({ data: req.body });
  return ok(res, room);
}

// ── Ish vaqti va istisnolar ─────────────────────────────────

async function listWorkingHours(req, res) {
  const doctorId = req.forcedDoctorId || Number(req.query.doctorId);
  if (!doctorId) throw fail('VALIDATION', 'doctorId kerak');
  const [hours, exceptions] = await Promise.all([
    prisma.workingHour.findMany({ where: { doctorId }, orderBy: { dayOfWeek: 'asc' } }),
    prisma.scheduleException.findMany({
      where: { doctorId, date: { gte: time.startOfDayUtc(time.dateKey(new Date())) } },
      orderBy: { date: 'asc' },
    }),
  ]);
  return ok(res, { hours, exceptions });
}

async function saveWorkingHours(req, res) {
  const doctorId = req.forcedDoctorId || Number(req.body.doctorId);
  if (!doctorId) throw fail('VALIDATION', 'doctorId kerak');

  const rows = req.body.hours || [];
  for (const row of rows) {
    const existing = await prisma.workingHour.findFirst({ where: { doctorId, dayOfWeek: Number(row.dayOfWeek) } });
    const data = {
      dayOfWeek: Number(row.dayOfWeek),
      startTime: row.startTime,
      endTime: row.endTime,
      breakStart: row.breakStart || null,
      breakEnd: row.breakEnd || null,
      isWorking: Boolean(row.isWorking),
      shift: row.shift || null,
    };
    if (existing) await prisma.workingHour.update({ where: { id: existing.id }, data });
    else await prisma.workingHour.create({ data: { ...data, doctorId } });
  }
  await auditService.record({ ...auditService.fromRequest(req), action: 'UPDATE', entity: 'WorkingHour', entityId: doctorId });
  return ok(res, await prisma.workingHour.findMany({ where: { doctorId }, orderBy: { dayOfWeek: 'asc' } }));
}

async function saveException(req, res) {
  const doctorId = req.forcedDoctorId || Number(req.body.doctorId);
  const date = time.startOfDayUtc(req.body.date);
  const exception = await prisma.scheduleException.upsert({
    where: { doctorId_date: { doctorId, date } },
    update: { type: req.body.type, startTime: req.body.startTime || null, endTime: req.body.endTime || null, note: req.body.note || null },
    create: { doctorId, date, type: req.body.type, startTime: req.body.startTime || null, endTime: req.body.endTime || null, note: req.body.note || null },
  });
  return ok(res, exception);
}

async function deleteException(req, res) {
  await prisma.scheduleException.delete({ where: { id: Number(req.params.id) } });
  return ok(res, { deleted: true });
}

// ── Bemorlar ────────────────────────────────────────────────

async function listPatients(req, res) {
  const { query, take = 50 } = req.query;
  const phone = query ? phoneUtil.normalize(query) : null;
  const patients = await prisma.patient.findMany({
    where: query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { medicalCardNumber: { contains: query, mode: 'insensitive' } },
            ...(phone ? [{ phone: { contains: phone.slice(-7) } }] : []),
          ],
        }
      : {},
    orderBy: { createdAt: 'desc' },
    take: Number(take),
  });
  return ok(res, patients);
}

async function getPatient(req, res) {
  const id = Number(req.params.id);
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      familyMembers: true,
      appointments: {
        where: doctorScope(req),
        include: { doctor: true, service: true, room: true },
        orderBy: { startTime: 'desc' },
      },
    },
  });
  if (!patient) throw fail('NOT_FOUND', 'Bemor topilmadi');

  // Tibbiy ma'lumotni kim ochgani yozib boriladi
  await auditService.record({ ...auditService.fromRequest(req), action: 'VIEW', entity: 'Patient', entityId: id });
  return ok(res, patient);
}

async function updatePatient(req, res) {
  const id = Number(req.params.id);
  const data = {};
  ['firstName', 'lastName', 'adminNote', 'discreetMode', 'isBlacklisted', 'blacklistReason', 'language']
    .forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (req.body.resetNoShow) data.noShowCount = 0;
  if (req.body.birthDate) data.birthDate = new Date(req.body.birthDate);

  const patient = await prisma.patient.update({ where: { id }, data });
  await auditService.record({ ...auditService.fromRequest(req), action: 'UPDATE', entity: 'Patient', entityId: id, newValue: data });
  return ok(res, patient);
}

// ── Qo'ng'iroqlar ───────────────────────────────────────────

async function listCallLogs(req, res) {
  const { outcome, onlyMisunderstood, take = 100 } = req.query;
  const calls = await prisma.callLog.findMany({
    where: {
      ...(outcome ? { outcome } : {}),
      ...(onlyMisunderstood === 'true' ? { misunderstandCount: { gt: 0 } } : {}),
    },
    include: { appointment: { include: { patient: true, doctor: true } } },
    orderBy: [{ outcome: 'asc' }, { startedAt: 'desc' }],
    take: Number(take),
  });
  return ok(res, calls);
}

async function getCallLog(req, res) {
  const call = await prisma.callLog.findUnique({
    where: { id: Number(req.params.id) },
    include: { appointment: { include: { patient: true, doctor: true, service: true } } },
  });
  if (!call) throw fail('NOT_FOUND', 'Qo\'ng\'iroq topilmadi');

  await auditService.record({ ...auditService.fromRequest(req), action: 'VIEW', entity: 'CallLog', entityId: call.id });

  // To'liq (maskalanmagan) raqamni faqat SUPERADMIN ko'radi
  const payload = req.admin.role === 'SUPERADMIN' ? call : { ...call, phone: phoneUtil.mask(call.phone) };
  return ok(res, payload);
}

async function listCallbackRequests(req, res) {
  const items = await prisma.callbackRequest.findMany({
    where: { isHandled: false },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return ok(res, items);
}

async function handleCallbackRequest(req, res) {
  const item = await prisma.callbackRequest.update({
    where: { id: Number(req.params.id) },
    data: { isHandled: true, handledAt: new Date(), note: req.body?.note || null },
  });
  return ok(res, item);
}

// ── Kutish ro'yxati ─────────────────────────────────────────

async function listWaitlist(req, res) {
  const items = await prisma.waitlist.findMany({
    where: { status: { in: ['WAITING', 'OFFERED'] } },
    include: { patient: true, service: true, doctor: true, specialty: true },
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, items);
}

async function deleteWaitlistEntry(req, res) {
  const item = await prisma.waitlist.update({
    where: { id: Number(req.params.id) },
    data: { status: 'CANCELLED' },
  });
  return ok(res, item);
}

// ── Sozlamalar, foydalanuvchilar, audit ─────────────────────

async function getSettings(req, res) {
  return ok(res, await settingsService.getSettings({ force: true }));
}

async function updateSettings(req, res) {
  const data = { ...req.body };
  delete data.id;
  ['cancellationWindowMinutes', 'minLeadTimeMinutes', 'appointmentBufferMinutes', 'noShowThreshold', 'recordingRetentionDays']
    .forEach((k) => { if (data[k] !== undefined) data[k] = Number(data[k]); });

  const settings = await prisma.siteSetting.update({ where: { id: 1 }, data });
  settingsService.invalidate();
  await auditService.record({ ...auditService.fromRequest(req), action: 'UPDATE', entity: 'SiteSetting', entityId: 1, newValue: data });
  return ok(res, settings);
}

async function listAdminUsers(req, res) {
  const users = await prisma.adminUser.findMany({
    select: { id: true, login: true, fullName: true, role: true, doctorId: true, isActive: true, lastLoginAt: true },
    orderBy: { id: 'asc' },
  });
  return ok(res, users);
}

async function upsertAdminUser(req, res) {
  const { login: userLogin, password, fullName, role, doctorId, isActive } = req.body || {};
  const id = req.params.id ? Number(req.params.id) : null;
  const data = {
    fullName,
    role,
    doctorId: doctorId ? Number(doctorId) : null,
    ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    ...(password ? { passwordHash: await bcrypt.hash(String(password), 10) } : {}),
  };
  const user = id
    ? await prisma.adminUser.update({ where: { id }, data })
    : await prisma.adminUser.create({ data: { ...data, login: userLogin, passwordHash: await bcrypt.hash(String(password || 'changeme'), 10) } });

  await auditService.record({ ...auditService.fromRequest(req), action: id ? 'UPDATE' : 'CREATE', entity: 'AdminUser', entityId: user.id });
  return ok(res, { id: user.id, login: user.login, role: user.role });
}

async function listAuditLogs(req, res) {
  const logs = await prisma.auditLog.findMany({
    include: { adminUser: { select: { login: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: Number(req.query.take || 200),
  });
  return ok(res, logs);
}

async function listReviews(req, res) {
  const reviews = await prisma.review.findMany({
    include: { patient: true, appointment: { include: { doctor: true, service: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return ok(res, reviews);
}

async function moderateReview(req, res) {
  const review = await prisma.review.update({
    where: { id: Number(req.params.id) },
    data: { isPublished: Boolean(req.body.isPublished) },
  });
  return ok(res, review);
}

module.exports = {
  login, me, dashboard, heatmap,
  listAppointments, updateAppointmentStatus, rescheduleAppointment, createAppointment, getAvailableSlotsAdmin,
  listDoctors, createDoctor, updateDoctor, toggleCalendar, cancelDoctorDay,
  listServices, upsertService, deleteService,
  listSpecialties, upsertSpecialty,
  listRooms, upsertRoom,
  listWorkingHours, saveWorkingHours, saveException, deleteException,
  listPatients, getPatient, updatePatient,
  listCallLogs, getCallLog, listCallbackRequests, handleCallbackRequest,
  listWaitlist, deleteWaitlistEntry,
  getSettings, updateSettings,
  listAdminUsers, upsertAdminUser, listAuditLogs,
  listReviews, moderateReview,
};
