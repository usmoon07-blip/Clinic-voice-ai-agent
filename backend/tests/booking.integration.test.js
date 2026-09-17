/**
 * Integratsiya testlari — HAQIQIY bazaga ulanadi.
 * Ishga tushirish: DATABASE_URL o'rnatilgan bo'lishi va `prisma migrate` + `seed`
 * bajarilgan bo'lishi kerak. DATABASE_URL bo'lmasa testlar o'tkazib yuboriladi.
 */
jest.mock('../src/services/notificationService', () => ({
  registerBot: jest.fn(),
  sendTelegram: jest.fn(),
  notifyPatient: jest.fn().mockResolvedValue({ channel: 'none' }),
  notifyDoctor: jest.fn().mockResolvedValue({ channel: 'none' }),
  onAppointmentCreated: jest.fn().mockResolvedValue(undefined),
  onAppointmentCancelled: jest.fn().mockResolvedValue(undefined),
  onPatientOnTheWay: jest.fn().mockResolvedValue(undefined),
  loadAppointment: jest.fn(),
}));

const { prisma } = require('../src/database/connection');
const bookingService = require('../src/services/bookingService');
const availability = require('../src/services/availabilityService');
const cancellationPolicy = require('../src/services/cancellationPolicyService');
const time = require('../src/utils/time');

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const TEST_PHONE = '+998900000001';
let service;
let doctor;
let patient;
const createdAppointmentIds = [];

/** Keyingi ish kunidagi birinchi bo'sh slot. */
async function findSlot(serviceId, doctorId) {
  const from = time.dateKey(new Date());
  const to = time.dateRange(from, 14)[13];
  const { slots } = await availability.getAvailableSlots({
    serviceId, doctorId, dateFrom: from, dateTo: to, limit: 5,
  });
  return slots[0];
}

describeDb('navbat olish (integratsiya)', () => {
  beforeAll(async () => {
    service = await prisma.service.findFirst({
      where: { isActive: true, category: 'CONSULTATION', minAge: { lte: 30 } },
      include: { doctors: true },
    });
    doctor = service.doctors[0];
    patient = await bookingService.findOrCreatePatient({
      phone: TEST_PHONE, firstName: 'Test', lastName: 'Bemor', birthDate: '1990-01-01', source: 'ADMIN',
    });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
    await prisma.appointment.deleteMany({ where: { patientId: patient?.id } });
    await prisma.patient.deleteMany({ where: { phone: TEST_PHONE } });
    await prisma.$disconnect();
  });

  test('navbat yaratiladi va o\'sha slot boshqa ko\'rinmaydi', async () => {
    const slot = await findSlot(service.id, doctor.id);
    expect(slot).toBeDefined();

    const { appointment } = await bookingService.createAppointment({
      patientId: patient.id, doctorId: doctor.id, serviceId: service.id,
      startTime: slot.startUtc, source: 'ADMIN',
    });
    createdAppointmentIds.push(appointment.id);

    expect(appointment.status).toBe('CONFIRMED');
    expect(appointment.roomId).toBeTruthy();

    const { slots: after } = await availability.getAvailableSlots({
      serviceId: service.id, doctorId: doctor.id,
      dateFrom: slot.date, dateTo: slot.date, limit: 100,
    });
    const stillOffered = after.some((s) => s.startUtc.getTime() === slot.startUtc.getTime());
    expect(stillOffered).toBe(false);
  });

  test('bir vaqtning o\'zida ikkita so\'rov bitta slotni band qila olmaydi', async () => {
    const slot = await findSlot(service.id, doctor.id);

    const results = await Promise.allSettled([
      bookingService.createAppointment({
        patientId: patient.id, doctorId: doctor.id, serviceId: service.id,
        startTime: slot.startUtc, source: 'TELEGRAM',
      }),
      bookingService.createAppointment({
        patientId: patient.id, doctorId: doctor.id, serviceId: service.id,
        startTime: slot.startUtc, source: 'VOICE',
      }),
    ]);

    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(['SLOT_TAKEN', 'DOCTOR_BUSY', 'NO_ROOM']).toContain(failed[0].reason.code);

    createdAppointmentIds.push(ok[0].value.appointment.id);
  });

  test('bir xil idempotency key bilan ikki marta chaqirsa — bitta navbat', async () => {
    const slot = await findSlot(service.id, doctor.id);
    const key = `test-idem-${Date.now()}`;

    const first = await bookingService.createAppointment({
      patientId: patient.id, doctorId: doctor.id, serviceId: service.id,
      startTime: slot.startUtc, source: 'VOICE', idempotencyKey: key,
    });
    const second = await bookingService.createAppointment({
      patientId: patient.id, doctorId: doctor.id, serviceId: service.id,
      startTime: slot.startUtc, source: 'VOICE', idempotencyKey: key,
    });

    createdAppointmentIds.push(first.appointment.id);
    expect(second.duplicate).toBe(true);
    expect(second.appointment.id).toBe(first.appointment.id);
  });

  test('yopiq kalendarli shifokorga navbat berilmaydi', async () => {
    await prisma.doctor.update({ where: { id: doctor.id }, data: { calendarStatus: 'CLOSED' } });
    try {
      const { slots } = await availability.getAvailableSlots({
        serviceId: service.id, doctorId: doctor.id,
        dateFrom: time.dateKey(new Date()), dateTo: time.dateRange(time.dateKey(new Date()), 7)[6],
        limit: 10,
      });
      expect(slots).toHaveLength(0);

      const slotCheck = await availability.checkSlot({
        doctorId: doctor.id, serviceId: service.id,
        startTime: new Date(Date.now() + 3 * 86400000),
      });
      expect(slotCheck.ok).toBe(false);
      expect(slotCheck.reason).toBe('CALENDAR_CLOSED');
    } finally {
      await prisma.doctor.update({ where: { id: doctor.id }, data: { calendarStatus: 'OPEN' } });
    }
  });
});

describeDb('bekor qilish oynasi', () => {
  test('2 soatdan kam qolganda bemor bekor qila olmaydi, admin qila oladi', async () => {
    const soon = { startTime: new Date(Date.now() + 30 * 60000), status: 'CONFIRMED' };

    const byPatient = await cancellationPolicy.canCancel(soon, { actor: 'PATIENT' });
    expect(byPatient.allowed).toBe(false);
    expect(byPatient.reason).toBe('WINDOW_PASSED');
    expect(cancellationPolicy.explain(byPatient, 'UZ')).toMatch(/Bekor qilish muddati/);

    const byAdmin = await cancellationPolicy.canCancel(soon, { actor: 'ADMIN' });
    expect(byAdmin.allowed).toBe(true);
  });

  test('ko\'p vaqt qolganda bemor bekor qila oladi', async () => {
    const later = { startTime: new Date(Date.now() + 5 * 3600000), status: 'CONFIRMED' };
    const result = await cancellationPolicy.canCancel(later, { actor: 'PATIENT' });
    expect(result.allowed).toBe(true);
  });

  test('allaqachon yopilgan navbat qayta bekor qilinmaydi', async () => {
    const done = { startTime: new Date(Date.now() + 5 * 3600000), status: 'CANCELLED' };
    const result = await cancellationPolicy.canCancel(done, { actor: 'ADMIN' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('ALREADY_CLOSED');
  });
});
