/** Eslatmalar: job ikki marta ishga tushsa ham xabar BIR MARTA yuboriladi. */
jest.mock('../src/services/notificationService', () => ({
  registerBot: jest.fn(),
  notifyPatient: jest.fn().mockResolvedValue({ channel: 'telegram' }),
  notifyDoctor: jest.fn().mockResolvedValue({ channel: 'telegram' }),
  onAppointmentCreated: jest.fn().mockResolvedValue(undefined),
  onAppointmentCancelled: jest.fn().mockResolvedValue(undefined),
  onPatientOnTheWay: jest.fn().mockResolvedValue(undefined),
  loadAppointment: jest.fn(),
}));

const { prisma } = require('../src/database/connection');
const notificationService = require('../src/services/notificationService');
const reminderJob = require('../src/jobs/reminderJob');
const noShowJob = require('../src/jobs/noShowJob');
const bookingService = require('../src/services/bookingService');

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const PHONE = '+998900000009';
let patient;
let doctor;
let service;
let room;

async function makeAppointment(startTime, patch = {}) {
  return prisma.appointment.create({
    data: {
      patientId: patient.id, doctorId: doctor.id, serviceId: service.id, roomId: room.id,
      startTime,
      endTime: new Date(startTime.getTime() + service.durationMinutes * 60000),
      price: service.price, status: 'CONFIRMED', source: 'TELEGRAM',
      ...patch,
    },
  });
}

describeDb('eslatmalar va kelmaganlik', () => {
  beforeAll(async () => {
    patient = await bookingService.findOrCreatePatient({
      phone: PHONE, firstName: 'Eslatma', lastName: 'Testov', source: 'ADMIN',
    });
    await prisma.patient.update({ where: { id: patient.id }, data: { telegramId: '999000111' } });
    service = await prisma.service.findFirst({ where: { isActive: true, category: 'CONSULTATION' }, include: { doctors: true } });
    doctor = service.doctors[0];
    room = await prisma.room.findFirst({ where: { isActive: true } });
  });

  beforeEach(() => jest.clearAllMocks());

  afterEach(async () => {
    await prisma.appointment.deleteMany({ where: { patientId: patient.id } });
  });

  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { phone: PHONE } });
    await prisma.$disconnect();
  });

  test('24 soatlik eslatma bir marta yuboriladi', async () => {
    const appt = await makeAppointment(new Date(Date.now() + 24 * 3600000));

    const firstRun = await reminderJob.sendDayBeforeReminders();
    expect(firstRun).toBeGreaterThanOrEqual(1);
    const callsAfterFirst = notificationService.notifyPatient.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1);

    // Job qayta ishga tushdi
    await reminderJob.sendDayBeforeReminders();
    expect(notificationService.notifyPatient.mock.calls.length).toBe(callsAfterFirst);

    const saved = await prisma.appointment.findUnique({ where: { id: appt.id } });
    expect(saved.dayBeforeReminderSentAt).not.toBeNull();
  });

  test('2 soatlik eslatma ham bir marta yuboriladi', async () => {
    await makeAppointment(new Date(Date.now() + 2 * 3600000));

    await reminderJob.sendHourBeforeReminders();
    const calls = notificationService.notifyPatient.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(1);

    await reminderJob.sendHourBeforeReminders();
    expect(notificationService.notifyPatient.mock.calls.length).toBe(calls);
  });

  test('bekor qilingan navbatga eslatma ketmaydi', async () => {
    await makeAppointment(new Date(Date.now() + 24 * 3600000), { status: 'CANCELLED' });
    const sent = await reminderJob.sendDayBeforeReminders();
    expect(sent).toBe(0);
    expect(notificationService.notifyPatient).not.toHaveBeenCalled();
  });

  test('kelmagan bemor belgilanadi va hisobi oshadi', async () => {
    const before = await prisma.patient.findUnique({ where: { id: patient.id } });
    const appt = await makeAppointment(new Date(Date.now() - 45 * 60000));

    await noShowJob.run();

    const saved = await prisma.appointment.findUnique({ where: { id: appt.id } });
    const after = await prisma.patient.findUnique({ where: { id: patient.id } });
    expect(saved.status).toBe('NO_SHOW');
    expect(after.noShowCount).toBe(before.noShowCount + 1);

    await prisma.patient.update({ where: { id: patient.id }, data: { noShowCount: before.noShowCount } });
  });

  test('chegaradan oshgan bemorga onlayn navbat berilmaydi', async () => {
    await prisma.patient.update({ where: { id: patient.id }, data: { noShowCount: 5 } });
    const fresh = await prisma.patient.findUnique({ where: { id: patient.id } });

    await expect(bookingService.assertPatientAllowed(fresh)).rejects.toMatchObject({ code: 'NO_SHOW_LIMIT' });

    await prisma.patient.update({ where: { id: patient.id }, data: { noShowCount: 0 } });
  });
});
