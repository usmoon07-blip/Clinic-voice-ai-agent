/**
 * Voice Agent senariylari (4.9-bo'limdagi dialoglar).
 * AI modeli chaqirilmaydi — bu yerda AI dan OLDIN ishlaydigan himoya qatlamlari
 * va tool funksiyalari tekshiriladi. Aynan shular AI xato qilsa ham tizimni ushlab turadi.
 */
jest.mock('../src/services/notificationService', () => ({
  registerBot: jest.fn(),
  notifyPatient: jest.fn().mockResolvedValue({ channel: 'none' }),
  notifyDoctor: jest.fn().mockResolvedValue({ channel: 'none' }),
  onAppointmentCreated: jest.fn().mockResolvedValue(undefined),
  onAppointmentCancelled: jest.fn().mockResolvedValue(undefined),
  onPatientOnTheWay: jest.fn().mockResolvedValue(undefined),
  loadAppointment: jest.fn(),
}));

const { prisma } = require('../src/database/connection');
const voiceAgent = require('../src/core/voiceAgent');
const voiceTools = require('../src/services/voiceTools');
const aiClient = require('../src/core/aiClient');
const bookingService = require('../src/services/bookingService');
const time = require('../src/utils/time');

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const session = (extra = {}) => ({
  callSid: 'test-call', callerPhone: '+998900000002', language: 'UZ',
  lastSlots: [], messages: [], transcript: [], misunderstandCount: 0,
  latencies: [], turn: 1, startedAt: Date.now(), ...extra,
});

describe('3-senariy: shoshilinch holat AI ga yetib bormaydi', () => {
  test('ko\'krak og\'rig\'i + nafas qisilishi darhol operatorga uzatiladi', async () => {
    const result = await voiceAgent.handleUtterance({
      callSid: `emg-${Date.now()}`,
      text: "otamning ko'kragi qattiq og'riyapti, nafasi qisilyapti",
      callerPhone: '+998900000003',
    });
    expect(result.action).toBe('TRANSFER');
    expect(result.say).toMatch(/103/);
    expect(result.session.outcome).toBe('EMERGENCY');
    // Navbat olish boshlanmagan bo'lishi kerak
    expect(result.session.createdAppointmentId).toBeUndefined();
  });
});

describe('operator so\'rovi va tushunmovchilik', () => {
  test('bemor operator so\'rasa — darhol uzatiladi', async () => {
    const result = await voiceAgent.handleUtterance({
      callSid: `op-${Date.now()}`,
      text: 'operator bilan gaplashmoqchiman',
      callerPhone: '+998900000004',
    });
    expect(result.action).toBe('TRANSFER');
    expect(result.session.outcome).toBe('ESCALATED');
  });

  test('2 marta jimlik/tushunmovchilikdan keyin operatorga uzatiladi', async () => {
    const callSid = `mis-${Date.now()}`;
    const first = await voiceAgent.handleUtterance({ callSid, text: '', callerPhone: '+998900000005' });
    expect(first.action).toBe('CONTINUE');

    const second = await voiceAgent.handleUtterance({ callSid, text: '', callerPhone: '+998900000005' });
    expect(second.action).toBe('TRANSFER');
  });
});

describe('7-senariy: til aniqlash', () => {
  test('ruscha nutq RU deb aniqlanadi', () => {
    expect(aiClient.detectLanguage('Здравствуйте, хочу записаться к гинекологу')).toBe('RU');
  });
  test('o\'zbekcha nutq UZ deb aniqlanadi', () => {
    expect(aiClient.detectLanguage('Assalomu alaykum, terapevtga yozilmoqchiman')).toBe('UZ');
  });
  test('aralash nutqda o\'zbekcha belgilar ustun kelsa UZ', () => {
    expect(aiClient.detectLanguage("zapisatsa bo'lmoqchiman, navbat bormi")).toBe('UZ');
  });
});

describeDb('1 va 2-senariy: marshrutlash va bo\'sh vaqt', () => {
  test('"terapevtga yozilmoqchiman" -> terapevt mutaxassisligi', async () => {
    const result = await voiceTools.execute('find_specialty', { complaint_text: 'terapevtga yozilmoqchiman' }, session());
    expect(result.found).toBe(true);
    expect(result.specialty.name).toMatch(/Terapevt/i);
    expect(result.services.length).toBeGreaterThan(0);
  });

  test('"bolamning qulog\'i og\'riyapti" (5 yosh) -> bolalar yo\'nalishi', async () => {
    const result = await voiceTools.execute(
      'find_specialty',
      { complaint_text: "bolamning qulog'i og'riyapti", patient_age: 5 },
      session(),
    );
    expect(result.found).toBe(true);
    expect(result.specialty.name).toMatch(/Pediatr|LOR/i);
  });

  test('get_available_slots faqat real slotlarni qaytaradi va "ertaga" ni tushunadi', async () => {
    const svc = await prisma.service.findFirst({ where: { isActive: true, category: 'CONSULTATION' } });
    const s = session();
    const result = await voiceTools.execute('get_available_slots', { service_id: svc.id, date_from: 'ertaga' }, s);

    if (result.slots.length > 0) {
      for (const slot of result.slots) {
        expect(slot.start_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(slot.doctor_name).toBeTruthy();
        expect(typeof slot.price).toBe('number');
      }
      // Sessiyada saqlanadi — AI keyin aynan shu slotni ishlatadi
      expect(s.lastSlots.length).toBeGreaterThan(0);
    } else {
      expect(result.reason).toBeTruthy();
    }
  });
});

describeDb('8-senariy: maxfiylik — shaxs tasdiqlanmasdan ma\'lumot berilmaydi', () => {
  const phone = '+998900000006';
  let patient;

  beforeAll(async () => {
    patient = await bookingService.findOrCreatePatient({
      phone, firstName: 'Maxfiy', lastName: 'Bemorov', birthDate: '1985-07-07', source: 'ADMIN',
    });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { patientId: patient.id } });
    await prisma.patient.deleteMany({ where: { phone } });
    await prisma.$disconnect();
  });

  test('tasdiqlanmagan holda navbatlar ro\'yxati berilmaydi', async () => {
    const result = await voiceTools.execute('get_patient_appointments', { patient_id: patient.id }, session());
    expect(result.error).toBe('NOT_VERIFIED');
    expect(result.appointments).toBeUndefined();
  });

  test('noto\'g\'ri familiya bilan tasdiqlash o\'tmaydi', async () => {
    const result = await voiceTools.execute(
      'verify_patient_identity',
      { phone, name_or_birth_year: 'Boshqaev' },
      session(),
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('MISMATCH');
  });

  test('to\'g\'ri familiya yoki tug\'ilgan yil bilan tasdiqlanadi', async () => {
    const byName = await voiceTools.execute('verify_patient_identity', { phone, name_or_birth_year: 'Bemorov' }, session());
    expect(byName.verified).toBe(true);

    const byYear = await voiceTools.execute('verify_patient_identity', { phone, name_or_birth_year: '1985' }, session());
    expect(byYear.verified).toBe(true);
  });

  test('tasdiqlangandan keyin navbatlar ko\'rinadi', async () => {
    const s = session();
    await voiceTools.execute('verify_patient_identity', { phone, name_or_birth_year: 'Bemorov' }, s);
    const result = await voiceTools.execute('get_patient_appointments', { patient_id: patient.id }, s);
    expect(Array.isArray(result.appointments)).toBe(true);
  });

  test('find_patient_by_phone familiyani oshkor qilmaydi', async () => {
    const result = await voiceTools.execute('find_patient_by_phone', { phone }, session());
    expect(result.found).toBe(true);
    expect(result.first_name).toBe('Maxfiy');
    expect(result.last_name).toBeUndefined();
  });
});

describeDb('5-senariy: bo\'sh joy bo\'lmasa kutish ro\'yxati', () => {
  const phone = '+998900000007';
  let patient;
  let svc;

  beforeAll(async () => {
    patient = await bookingService.findOrCreatePatient({ phone, firstName: 'Kutuvchi', source: 'ADMIN' });
    svc = await prisma.service.findFirst({ where: { isActive: true } });
  });

  afterAll(async () => {
    await prisma.waitlist.deleteMany({ where: { patientId: patient.id } });
    await prisma.patient.deleteMany({ where: { phone } });
    await prisma.$disconnect();
  });

  test('add_to_waitlist yozuv yaratadi', async () => {
    const result = await voiceTools.execute(
      'add_to_waitlist',
      { patient_id: patient.id, service_id: svc.id, date_from: 'ertaga' },
      session(),
    );
    expect(result.success).toBe(true);
    const entry = await prisma.waitlist.findUnique({ where: { id: result.waitlist_id } });
    expect(entry.status).toBe('WAITING');
  });
});

describeDb('6-senariy: bekor qilish oynasi AI uchun ham amal qiladi', () => {
  const phone = '+998900000008';
  let patient;
  let appointment;

  beforeAll(async () => {
    patient = await bookingService.findOrCreatePatient({
      phone, firstName: 'Bekor', lastName: 'Qiluvchi', birthDate: '1992-02-02', source: 'ADMIN',
    });
    const svc = await prisma.service.findFirst({ where: { isActive: true, category: 'CONSULTATION' }, include: { doctors: true } });
    const doctor = svc.doctors[0];
    // Qabulgacha 30 daqiqa qolgan navbat (bazaga to'g'ridan-to'g'ri yoziladi)
    const room = await prisma.room.findFirst({ where: { isActive: true } });
    appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id, doctorId: doctor.id, serviceId: svc.id, roomId: room.id,
        startTime: new Date(Date.now() + 30 * 60000),
        endTime: new Date(Date.now() + 60 * 60000),
        price: svc.price, status: 'CONFIRMED', source: 'VOICE',
      },
    });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { patientId: patient.id } });
    await prisma.patient.deleteMany({ where: { phone } });
    await prisma.$disconnect();
  });

  test('30 daqiqa qolganda AI bekor qila olmaydi va aytadigan matnni oladi', async () => {
    const s = session({ verifiedPatientId: patient.id });
    const result = await voiceTools.execute('cancel_appointment', { appointment_id: appointment.id }, s);

    expect(result.success).toBe(false);
    expect(result.error).toBe('WINDOW_PASSED');
    expect(result.say_this).toMatch(/Bekor qilish muddati/);
    expect(result.hint).toMatch(/operator/i);

    const still = await prisma.appointment.findUnique({ where: { id: appointment.id } });
    expect(still.status).toBe('CONFIRMED');
  });

  test('tasdiqlanmagan chaqiruvchi bekor qila olmaydi', async () => {
    const result = await voiceTools.execute('cancel_appointment', { appointment_id: appointment.id }, session());
    expect(result.error).toBe('NOT_VERIFIED');
  });
});
