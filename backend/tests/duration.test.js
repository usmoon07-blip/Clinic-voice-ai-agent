/**
 * Qabul davomiyligi: har bir bemorga bir xil vaqt qo'yilmaydi.
 *  - davomiylik XIZMATdan olinadi (terapevt 30 daq, kardiolog 40 daq, EKG 15 daq)
 *  - takroriy qabul qisqaroq bo'lishi mumkin (followUpDurationMinutes)
 *  - registratura aniq bir navbatni qo'lda uzaytira oladi
 */
jest.mock('../src/services/notificationService', () => ({
  registerBot: jest.fn(),
  notifyPatient: jest.fn().mockResolvedValue({ channel: 'none' }),
  notifyDoctor: jest.fn().mockResolvedValue({ channel: 'none' }),
  onAppointmentCreated: jest.fn().mockResolvedValue(undefined),
  onAppointmentCancelled: jest.fn().mockResolvedValue(undefined),
  onPatientOnTheWay: jest.fn().mockResolvedValue(undefined),
  alertEmergency: jest.fn().mockResolvedValue({ notified: 0 }),
  loadAppointment: jest.fn(),
}));

const { prisma } = require('../src/database/connection');
const availability = require('../src/services/availabilityService');
const bookingService = require('../src/services/bookingService');
const time = require('../src/utils/time');

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describe('durationFor', () => {
  const service = { durationMinutes: 40, followUpDurationMinutes: 15 };

  test('birlamchi qabul — xizmatning to\'liq vaqti', () => {
    expect(availability.durationFor(service, 'FIRST')).toBe(40);
  });

  test('takroriy qabul — qisqartirilgan vaqt', () => {
    expect(availability.durationFor(service, 'FOLLOW_UP')).toBe(15);
  });

  test('takroriy vaqt ko\'rsatilmagan bo\'lsa — o\'sha vaqt qoladi', () => {
    expect(availability.durationFor({ durationMinutes: 25 }, 'FOLLOW_UP')).toBe(25);
  });
});

describeDb('davomiylik bazadan olinadi', () => {
  const PHONE = '+998900000010';
  let patient;

  beforeAll(async () => {
    patient = await bookingService.findOrCreatePatient({
      phone: PHONE, firstName: 'Davomiylik', lastName: 'Testov', birthDate: '1988-08-08', source: 'ADMIN',
    });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { patientId: patient.id } });
    await prisma.patient.deleteMany({ where: { phone: PHONE } });
    await prisma.$disconnect();
  });

  test('har xil xizmat — har xil slot uzunligi', async () => {
    const from = time.dateKey(new Date());
    const to = time.dateRange(from, 10)[9];

    const services = await prisma.service.findMany({
      where: { isActive: true, durationMinutes: { in: [15, 30, 40] } },
      take: 6,
    });
    expect(services.length).toBeGreaterThan(1);

    for (const svc of services) {
      // eslint-disable-next-line no-await-in-loop
      const { slots } = await availability.getAvailableSlots({
        serviceId: svc.id, dateFrom: from, dateTo: to, limit: 1,
      });
      if (slots.length) {
        expect(slots[0].durationMinutes).toBe(svc.durationMinutes);
        const minutes = (slots[0].endUtc - slots[0].startUtc) / 60000;
        expect(minutes).toBe(svc.durationMinutes);
      }
    }
  });

  test('bemor avval kelgan bo\'lsa — takroriy qabul vaqti qo\'llanadi', async () => {
    const svc = await prisma.service.findFirst({
      where: { isActive: true, followUpDurationMinutes: { not: null } },
      include: { doctors: true },
    });
    expect(svc).toBeTruthy();
    const doctor = svc.doctors[0];
    const room = await prisma.room.findFirst({ where: { isActive: true } });

    // O'tgan, yakunlangan qabul — endi bemor "takroriy"
    await prisma.appointment.create({
      data: {
        patientId: patient.id, doctorId: doctor.id, serviceId: svc.id, roomId: room.id,
        startTime: new Date(Date.now() - 20 * 86400000),
        endTime: new Date(Date.now() - 20 * 86400000 + svc.durationMinutes * 60000),
        price: svc.price, status: 'COMPLETED', source: 'ADMIN',
      },
    });

    const from = time.dateKey(new Date());
    const to = time.dateRange(from, 10)[9];

    const forThisPatient = await availability.getAvailableSlots({
      serviceId: svc.id, doctorId: doctor.id, dateFrom: from, dateTo: to, patientId: patient.id, limit: 1,
    });
    const forNewPatient = await availability.getAvailableSlots({
      serviceId: svc.id, doctorId: doctor.id, dateFrom: from, dateTo: to, limit: 1,
    });

    expect(forThisPatient.slots[0].visitType).toBe('FOLLOW_UP');
    expect(forThisPatient.slots[0].durationMinutes).toBe(svc.followUpDurationMinutes);
    expect(forNewPatient.slots[0].durationMinutes).toBe(svc.durationMinutes);
    expect(forThisPatient.slots[0].durationMinutes).toBeLessThan(forNewPatient.slots[0].durationMinutes);
  });

  test('registratura navbatni qo\'lda uzaytira oladi', async () => {
    const svc = await prisma.service.findFirst({
      where: { isActive: true, category: 'CONSULTATION' },
      include: { doctors: true },
    });
    const doctor = svc.doctors[0];
    const from = time.dateKey(new Date());
    const to = time.dateRange(from, 10)[9];
    const { slots } = await availability.getAvailableSlots({
      serviceId: svc.id, doctorId: doctor.id, dateFrom: from, dateTo: to, limit: 50,
    });
    // Ertalabki slot — uzaytirilganda ish vaqtidan chiqib ketmasligi uchun
    const morning = slots.find((sl) => Number(sl.time.slice(0, 2)) < 11);
    expect(morning).toBeDefined();

    const { appointment } = await bookingService.createAppointment({
      patientId: patient.id, doctorId: doctor.id, serviceId: svc.id,
      startTime: morning.startUtc, source: 'ADMIN',
      durationMinutes: 60, skipPatientChecks: true,
    });

    const minutes = (appointment.endTime - appointment.startTime) / 60000;
    expect(minutes).toBe(60);
    expect(appointment.durationMinutes).toBe(60);
  });

  test('uzaytirilgan vaqt ish kuniga sig\'masa — rad etiladi', async () => {
    const svc = await prisma.service.findFirst({
      where: { isActive: true, category: 'CONSULTATION' },
      include: { doctors: true },
    });
    const doctor = svc.doctors[0];
    const from = time.dateKey(new Date());
    const to = time.dateRange(from, 10)[9];
    const { slots } = await availability.getAvailableSlots({
      serviceId: svc.id, doctorId: doctor.id, dateFrom: from, dateTo: to, limit: 200,
    });
    // Kun oxiridagi slot
    const last = [...slots].reverse().find((sl) => Number(sl.time.slice(0, 2)) >= 16);
    if (!last) return;

    const check = await availability.checkSlot({
      doctorId: doctor.id, serviceId: svc.id, startTime: last.startUtc, durationMinutes: 120,
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('OUTSIDE_WORKING_HOURS');
  });
});
