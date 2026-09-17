'use strict';
/**
 * Boshlang'ich ma'lumotlar: mutaxassisliklar, shifokorlar, xizmatlar,
 * kabinetlar, ish vaqtlari, sozlamalar va SUPERADMIN.
 * Ishga tushirish:  npx prisma db seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const config = require('../src/config/default');

const prisma = new PrismaClient();

const SPECIALTIES = [
  {
    key: 'therapist',
    nameUz: 'Terapevt', nameRu: 'Терапевт', icon: '🩺', sortOrder: 1,
    descriptionUz: 'Umumiy amaliyot shifokori, birlamchi ko\'rik',
    descriptionRu: 'Врач общей практики, первичный осмотр',
    symptomAliases: [
      'harorat', 'isitma', 'shamollash', 'yo\'tal', 'tomoq og\'riqsa', 'grip', 'holsizlik',
      'bosh og\'rigi', 'umumiy ko\'rik', 'spravka', 'ma\'lumotnoma',
      'температура', 'простуда', 'кашель', 'слабость', 'справка', 'терапевт',
    ],
  },
  {
    key: 'pediatrician',
    nameUz: 'Pediatr', nameRu: 'Педиатр', icon: '👶', sortOrder: 2,
    descriptionUz: 'Bolalar shifokori (0-18 yosh)',
    descriptionRu: 'Детский врач (0-18 лет)',
    symptomAliases: [
      'bolam', 'bolamning', 'chaqaloq', 'go\'dak', 'bolalar shifokori', 'emlash',
      'ребенок', 'ребёнок', 'малыш', 'детский врач', 'прививка', 'педиатр',
    ],
  },
  {
    key: 'cardiologist',
    nameUz: 'Kardiolog', nameRu: 'Кардиолог', icon: '❤️', sortOrder: 3,
    descriptionUz: 'Yurak va qon tomir kasalliklari',
    descriptionRu: 'Заболевания сердца и сосудов',
    symptomAliases: [
      'yuragim', 'yurak', 'bosim', 'qon bosimi', 'yurak urishi', 'yurak sanchiyapti',
      'kardiogramma', 'ekg',
      'сердце', 'давление', 'сердцебиение', 'экг', 'кардиолог',
    ],
  },
  {
    key: 'neurologist',
    nameUz: 'Nevrolog', nameRu: 'Невролог', icon: '🧠', sortOrder: 4,
    descriptionUz: 'Asab tizimi kasalliklari',
    descriptionRu: 'Заболевания нервной системы',
    symptomAliases: [
      'bosh og\'riq', 'migren', 'bel og\'rigi', 'uyqusizlik', 'qo\'l uvishishi',
      'bo\'yin og\'rigi', 'radikulit',
      'голова болит', 'мигрень', 'спина', 'поясница', 'бессонница', 'невролог',
    ],
  },
  {
    key: 'gynecologist',
    nameUz: 'Ginekolog', nameRu: 'Гинеколог', icon: '🌸', sortOrder: 5,
    descriptionUz: 'Ayollar salomatligi',
    descriptionRu: 'Женское здоровье',
    symptomAliases: [
      'ginekolog', 'homiladorlik', 'ayollar shifokori', 'homilador',
      'гинеколог', 'беременность', 'женский врач',
    ],
  },
  {
    key: 'ent',
    nameUz: 'LOR (Otolaringolog)', nameRu: 'ЛОР (Отоларинголог)', icon: '👂', sortOrder: 6,
    descriptionUz: 'Quloq, burun, tomoq kasalliklari',
    descriptionRu: 'Заболевания уха, горла, носа',
    symptomAliases: [
      'quloq', 'quloq og\'riyapti', 'burun', 'tomoq', 'gaymorit', 'anginam', 'lor',
      'ухо', 'нос', 'горло', 'гайморит', 'ангина', 'лор',
    ],
  },
  {
    key: 'dermatologist',
    nameUz: 'Dermatolog', nameRu: 'Дерматолог', icon: '🧴', sortOrder: 7,
    descriptionUz: 'Teri kasalliklari',
    descriptionRu: 'Заболевания кожи',
    symptomAliases: [
      'teri', 'toshma', 'qichishish', 'allergiya', 'xol', 'soch to\'kilishi',
      'кожа', 'сыпь', 'зуд', 'аллергия', 'родинка', 'дерматолог',
    ],
  },
  {
    key: 'ultrasound',
    nameUz: 'UTT (UZI) mutaxassisi', nameRu: 'Специалист УЗИ', icon: '📡', sortOrder: 8,
    descriptionUz: 'Ultratovush tekshiruvi',
    descriptionRu: 'Ультразвуковое исследование',
    symptomAliases: [
      'uzi', 'utt', 'ultratovush', 'uzi qildirmoqchiman', 'tekshiruv',
      'узи', 'ультразвук', 'обследование',
    ],
  },
];

const ROOMS = [
  { name: '1-kabinet', type: 'CONSULTATION' },
  { name: '2-kabinet', type: 'CONSULTATION' },
  { name: '3-kabinet', type: 'CONSULTATION' },
  { name: 'UTT xonasi', type: 'ULTRASOUND' },
  { name: 'EKG xonasi', type: 'ECG' },
  { name: 'Muolaja xonasi', type: 'PROCEDURE' },
  { name: 'Laboratoriya', type: 'LABORATORY' },
];

const DOCTORS = [
  {
    firstName: 'Nodira', lastName: 'Yusupova', specialty: 'therapist', gender: 'FEMALE',
    category: 'Oliy toifa', experienceYears: 14, licenseNumber: 'LIC-000114',
    bioUz: 'Umumiy amaliyot shifokori. Birlamchi ko\'rik, surunkali kasalliklar kuzatuvi.',
    bioRu: 'Врач общей практики. Первичный осмотр, ведение хронических заболеваний.',
    minAge: 18, maxAge: 120, firstVisitPrice: 120000, followUpPrice: 80000,
  },
  {
    firstName: 'Aziz', lastName: 'Karimov', specialty: 'therapist', gender: 'MALE',
    category: 'Birinchi toifa', experienceYears: 8, licenseNumber: 'LIC-000208',
    bioUz: 'Terapevt. Profilaktik ko\'rik va ma\'lumotnomalar.',
    bioRu: 'Терапевт. Профилактические осмотры и справки.',
    minAge: 18, maxAge: 120, firstVisitPrice: 100000, followUpPrice: 70000,
  },
  {
    firstName: 'Malika', lastName: 'Rahimova', specialty: 'pediatrician', gender: 'FEMALE',
    category: 'Oliy toifa', experienceYears: 17, licenseNumber: 'LIC-000317',
    bioUz: 'Bolalar shifokori. Chaqaloqlar va maktabgacha yoshdagi bolalar.',
    bioRu: 'Детский врач. Новорождённые и дети дошкольного возраста.',
    minAge: 0, maxAge: 18, firstVisitPrice: 130000, followUpPrice: 90000,
  },
  {
    firstName: 'Sardor', lastName: 'Toshev', specialty: 'cardiologist', gender: 'MALE',
    category: 'Oliy toifa, t.f.n.', experienceYears: 21, licenseNumber: 'LIC-000421',
    bioUz: 'Kardiolog. Gipertoniya, aritmiya, yurak yetishmovchiligi.',
    bioRu: 'Кардиолог. Гипертония, аритмия, сердечная недостаточность.',
    minAge: 18, maxAge: 120, firstVisitPrice: 180000, followUpPrice: 120000,
  },
  {
    firstName: 'Dilnoza', lastName: 'Ergasheva', specialty: 'neurologist', gender: 'FEMALE',
    category: 'Birinchi toifa', experienceYears: 11, licenseNumber: 'LIC-000511',
    bioUz: 'Nevrolog. Bosh og\'rig\'i, osteoxondroz, uyqu buzilishi.',
    bioRu: 'Невролог. Головные боли, остеохондроз, нарушения сна.',
    minAge: 12, maxAge: 120, firstVisitPrice: 160000, followUpPrice: 110000,
  },
  {
    firstName: 'Gulnora', lastName: 'Saidova', specialty: 'gynecologist', gender: 'FEMALE',
    category: 'Oliy toifa', experienceYears: 19, licenseNumber: 'LIC-000619',
    bioUz: 'Akusher-ginekolog. Homiladorlikni kuzatish, profilaktik ko\'rik.',
    bioRu: 'Акушер-гинеколог. Ведение беременности, профилактический осмотр.',
    minAge: 15, maxAge: 120, firstVisitPrice: 170000, followUpPrice: 120000,
  },
  {
    firstName: 'Jasur', lastName: 'Umarov', specialty: 'ent', gender: 'MALE',
    category: 'Birinchi toifa', experienceYears: 9, licenseNumber: 'LIC-000709',
    bioUz: 'LOR shifokori. Gaymorit, otit, angina.',
    bioRu: 'ЛОР-врач. Гайморит, отит, ангина.',
    minAge: 0, maxAge: 120, firstVisitPrice: 150000, followUpPrice: 100000,
  },
  {
    firstName: 'Shahnoza', lastName: 'Qodirova', specialty: 'ultrasound', gender: 'FEMALE',
    category: 'Oliy toifa', experienceYears: 13, licenseNumber: 'LIC-000813',
    bioUz: 'UTT mutaxassisi. Qorin bo\'shlig\'i, buyrak, qalqonsimon bez.',
    bioRu: 'Специалист УЗИ. Брюшная полость, почки, щитовидная железа.',
    minAge: 0, maxAge: 120, firstVisitPrice: 90000, followUpPrice: 90000,
  },
];

const SERVICES = [
  {
    specialty: 'therapist', nameUz: 'Terapevt konsultatsiyasi', nameRu: 'Консультация терапевта',
    descriptionUz: 'Birlamchi ko\'rik, shikoyatlarni tinglash, tekshiruvga yo\'llanma.',
    descriptionRu: 'Первичный осмотр, сбор жалоб, направление на обследование.',
    aliases: ['terapevt', 'shifokorga yozilish', 'ko\'rik', 'терапевт', 'приём терапевта'],
    price: 120000, durationMinutes: 30, category: 'CONSULTATION', requiredRoomType: 'CONSULTATION',
    minAge: 18,
  },
  {
    specialty: 'therapist', nameUz: 'Tibbiy ma\'lumotnoma (spravka)', nameRu: 'Медицинская справка',
    descriptionUz: 'Ish yoki o\'qish uchun ma\'lumotnoma rasmiylashtirish.',
    descriptionRu: 'Оформление справки для работы или учёбы.',
    aliases: ['spravka', 'ma\'lumotnoma', 'справка'],
    price: 60000, durationMinutes: 15, category: 'CONSULTATION', requiredRoomType: 'CONSULTATION',
    minAge: 16,
  },
  {
    specialty: 'pediatrician', nameUz: 'Pediatr konsultatsiyasi', nameRu: 'Консультация педиатра',
    descriptionUz: 'Bolani ko\'rikdan o\'tkazish va maslahat.',
    descriptionRu: 'Осмотр ребёнка и консультация.',
    aliases: ['pediatr', 'bolalar shifokori', 'педиатр', 'детский врач'],
    price: 130000, durationMinutes: 30, category: 'CONSULTATION', requiredRoomType: 'CONSULTATION',
    minAge: 0, maxAge: 18,
  },
  {
    specialty: 'pediatrician', nameUz: 'Emlash', nameRu: 'Вакцинация',
    descriptionUz: 'Kalendar bo\'yicha emlash. Emlashdan oldin pediatr ko\'rigi shart.',
    descriptionRu: 'Вакцинация по календарю. Перед прививкой обязателен осмотр педиатра.',
    aliases: ['emlash', 'vaksina', 'прививка', 'вакцина'],
    price: 90000, durationMinutes: 20, category: 'VACCINATION', requiredRoomType: 'PROCEDURE',
    minAge: 0, maxAge: 18,
    preparationUz: 'Emlash kuni bolaning harorati normal bo\'lishi kerak. Emlash guvohnomasini olib keling.',
    preparationRu: 'В день прививки температура ребёнка должна быть нормальной. Возьмите прививочный сертификат.',
  },
  {
    specialty: 'cardiologist', nameUz: 'Kardiolog konsultatsiyasi', nameRu: 'Консультация кардиолога',
    descriptionUz: 'Yurak-qon tomir tizimini baholash.',
    descriptionRu: 'Оценка состояния сердечно-сосудистой системы.',
    aliases: ['kardiolog', 'yurak shifokori', 'кардиолог'],
    price: 180000, durationMinutes: 40, category: 'CONSULTATION', requiredRoomType: 'CONSULTATION',
    minAge: 18,
  },
  {
    specialty: 'cardiologist', nameUz: 'EKG (Elektrokardiogramma)', nameRu: 'ЭКГ (Электрокардиограмма)',
    descriptionUz: 'Yurak elektr faoliyatini yozib olish.',
    descriptionRu: 'Запись электрической активности сердца.',
    aliases: ['ekg', 'kardiogramma', 'экг', 'кардиограмма'],
    price: 70000, durationMinutes: 15, category: 'DIAGNOSTICS', requiredRoomType: 'ECG',
    preparationUz: 'Tekshiruvdan 2 soat oldin qahva va energetik ichimlik ichmang, jismoniy zo\'riqishdan saqlaning.',
    preparationRu: 'За 2 часа до исследования не пейте кофе и энергетики, избегайте физических нагрузок.',
    prepReminderHours: 12,
  },
  {
    specialty: 'neurologist', nameUz: 'Nevrolog konsultatsiyasi', nameRu: 'Консультация невролога',
    descriptionUz: 'Asab tizimi bo\'yicha ko\'rik va maslahat.',
    descriptionRu: 'Осмотр и консультация по нервной системе.',
    aliases: ['nevrolog', 'невролог', 'nevropatolog'],
    price: 160000, durationMinutes: 40, category: 'CONSULTATION', requiredRoomType: 'CONSULTATION',
    minAge: 12,
  },
  {
    specialty: 'gynecologist', nameUz: 'Ginekolog konsultatsiyasi', nameRu: 'Консультация гинеколога',
    descriptionUz: 'Profilaktik ko\'rik va maslahat.',
    descriptionRu: 'Профилактический осмотр и консультация.',
    aliases: ['ginekolog', 'гинеколог'],
    price: 170000, durationMinutes: 40, category: 'CONSULTATION', requiredRoomType: 'CONSULTATION',
    minAge: 15, isSensitive: true,
  },
  {
    specialty: 'gynecologist', nameUz: 'Homiladorlikni kuzatish', nameRu: 'Ведение беременности',
    descriptionUz: 'Navbatdagi ko\'rik va kuzatuv.',
    descriptionRu: 'Плановый осмотр и наблюдение.',
    aliases: ['homiladorlik', 'беременность'],
    price: 150000, durationMinutes: 30, category: 'CONSULTATION', requiredRoomType: 'CONSULTATION',
    minAge: 15, isSensitive: true,
  },
  {
    specialty: 'ent', nameUz: 'LOR konsultatsiyasi', nameRu: 'Консультация ЛОР-врача',
    descriptionUz: 'Quloq, burun, tomoqni tekshirish.',
    descriptionRu: 'Осмотр уха, горла, носа.',
    aliases: ['lor', 'лор', 'квт shifokori'],
    price: 150000, durationMinutes: 30, category: 'CONSULTATION', requiredRoomType: 'CONSULTATION',
  },
  {
    specialty: 'ent', nameUz: 'Burun bo\'shlig\'ini yuvish', nameRu: 'Промывание носа',
    descriptionUz: 'Gaymorit va rinit davolash muolajasi. Kurs bo\'lib tayinlanadi.',
    descriptionRu: 'Процедура при гайморите и рините. Назначается курсом.',
    aliases: ['burun yuvish', 'kukushka', 'промывание', 'кукушка'],
    price: 80000, durationMinutes: 20, category: 'TREATMENT_COURSE', requiredRoomType: 'PROCEDURE',
    isCourse: true, sessionCount: 5, sessionIntervalDays: 1,
  },
  {
    specialty: 'dermatologist', nameUz: 'Dermatolog konsultatsiyasi', nameRu: 'Консультация дерматолога',
    descriptionUz: 'Teri holatini ko\'rikdan o\'tkazish.',
    descriptionRu: 'Осмотр состояния кожи.',
    aliases: ['dermatolog', 'дерматолог', 'teri shifokori'],
    price: 150000, durationMinutes: 30, category: 'CONSULTATION', requiredRoomType: 'CONSULTATION',
  },
  {
    specialty: 'ultrasound', nameUz: 'Qorin bo\'shlig\'i UTT', nameRu: 'УЗИ брюшной полости',
    descriptionUz: 'Jigar, o\'t pufagi, taloq, oshqozon osti bezi tekshiruvi.',
    descriptionRu: 'Исследование печени, желчного пузыря, селезёнки, поджелудочной железы.',
    aliases: ['qorin uzi', 'qorin utt', 'узи живота', 'узи брюшной'],
    price: 110000, durationMinutes: 25, category: 'DIAGNOSTICS', requiredRoomType: 'ULTRASOUND',
    preparationUz: 'Tekshiruvdan 6 soat oldin ovqat yemang. Gaz hosil qiluvchi mahsulotlardan bir kun oldin voz keching.',
    preparationRu: 'Не принимайте пищу за 6 часов до исследования. За сутки исключите газообразующие продукты.',
    prepReminderHours: 24,
  },
  {
    specialty: 'ultrasound', nameUz: 'Buyrak va siydik yo\'llari UTT', nameRu: 'УЗИ почек и мочевыводящих путей',
    descriptionUz: 'Buyraklar va qovuqni tekshirish.',
    descriptionRu: 'Исследование почек и мочевого пузыря.',
    aliases: ['buyrak uzi', 'узи почек'],
    price: 100000, durationMinutes: 25, category: 'DIAGNOSTICS', requiredRoomType: 'ULTRASOUND',
    preparationUz: 'Tekshiruvdan 1 soat oldin 1 litr suv iching va tahorat qilmang — qovuq to\'la bo\'lishi kerak.',
    preparationRu: 'За час до исследования выпейте 1 литр воды и не опорожняйте мочевой пузырь.',
    prepReminderHours: 12,
  },
  {
    specialty: 'therapist', nameUz: 'Umumiy qon tahlili', nameRu: 'Общий анализ крови',
    descriptionUz: 'Laboratoriya tahlili. Natija 1 ish kunida tayyor bo\'ladi.',
    descriptionRu: 'Лабораторный анализ. Результат готов за 1 рабочий день.',
    aliases: ['qon tahlili', 'analiz', 'qon topshirish', 'анализ крови', 'анализы'],
    price: 55000, durationMinutes: 15, category: 'LABORATORY', requiredRoomType: 'LABORATORY',
    preparationUz: 'Tahlil och qoringa topshiriladi — 8-12 soat ovqat yemang, faqat suv ichishingiz mumkin.',
    preparationRu: 'Анализ сдаётся натощак — не ешьте 8-12 часов, можно пить только воду.',
    prepReminderHours: 24,
  },
];

// Dushanba-juma 09:00-17:00 (13:00-14:00 tanaffus), shanba 09:00-13:00
function defaultWorkingHours() {
  const hours = [];
  for (let day = 1; day <= 5; day++) {
    hours.push({ dayOfWeek: day, startTime: '09:00', endTime: '17:00', breakStart: '13:00', breakEnd: '14:00', isWorking: true });
  }
  hours.push({ dayOfWeek: 6, startTime: '09:00', endTime: '13:00', breakStart: null, breakEnd: null, isWorking: true });
  hours.push({ dayOfWeek: 7, startTime: '09:00', endTime: '13:00', breakStart: null, breakEnd: null, isWorking: false });
  return hours;
}

async function main() {
  console.log('Seed boshlandi...');

  // ── Sozlamalar ──
  await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      clinicName: config.clinic.name,
      phone: config.clinic.phone,
      address: config.clinic.address,
      latitude: config.clinic.latitude,
      longitude: config.clinic.longitude,
      licenseNumber: 'LIC-CLINIC-0001',
      workingHoursText: 'Dush-Juma 09:00-17:00, Shanba 09:00-13:00',
      cancellationWindowMinutes: config.booking.cancellationWindowMinutes,
      minLeadTimeMinutes: config.booking.minLeadTimeMinutes,
      appointmentBufferMinutes: config.booking.bufferMinutes,
      noShowThreshold: config.booking.noShowThreshold,
      recordingRetentionDays: config.booking.recordingRetentionDays,
      emergencyPhone: config.clinic.emergencyPhone,
      operatorPhone: config.telephony.operatorPhone || null,
    },
  });

  // ── Kabinetlar ──
  const rooms = {};
  for (const room of ROOMS) {
    const existing = await prisma.room.findFirst({ where: { name: room.name } });
    const saved = existing
      ? await prisma.room.update({ where: { id: existing.id }, data: room })
      : await prisma.room.create({ data: room });
    rooms[room.type] = rooms[room.type] || [];
    rooms[room.type].push(saved);
  }
  console.log(`  ${ROOMS.length} ta kabinet`);

  // ── Mutaxassisliklar ──
  const specialties = {};
  for (const spec of SPECIALTIES) {
    const { key, ...data } = spec;
    const existing = await prisma.specialty.findFirst({ where: { nameUz: data.nameUz } });
    specialties[key] = existing
      ? await prisma.specialty.update({ where: { id: existing.id }, data })
      : await prisma.specialty.create({ data });
  }
  console.log(`  ${SPECIALTIES.length} ta mutaxassislik`);

  // ── Shifokorlar ──
  const doctors = [];
  for (const doc of DOCTORS) {
    const { specialty, ...data } = doc;
    const payload = { ...data, specialtyId: specialties[specialty].id };
    const existing = await prisma.doctor.findFirst({
      where: { firstName: data.firstName, lastName: data.lastName },
    });
    const saved = existing
      ? await prisma.doctor.update({ where: { id: existing.id }, data: payload })
      : await prisma.doctor.create({ data: payload });
    doctors.push(saved);

    // Ish vaqti
    for (const wh of defaultWorkingHours()) {
      const found = await prisma.workingHour.findFirst({
        where: { doctorId: saved.id, dayOfWeek: wh.dayOfWeek },
      });
      if (found) {
        await prisma.workingHour.update({ where: { id: found.id }, data: wh });
      } else {
        await prisma.workingHour.create({ data: { ...wh, doctorId: saved.id } });
      }
    }
  }
  console.log(`  ${DOCTORS.length} ta shifokor va ularning ish vaqti`);

  // ── Xizmatlar ──
  for (const svc of SERVICES) {
    const { specialty, ...data } = svc;
    const specialtyId = specialties[specialty].id;
    const doctorIds = doctors.filter((d) => d.specialtyId === specialtyId).map((d) => ({ id: d.id }));
    const payload = { ...data, specialtyId };

    const existing = await prisma.service.findFirst({ where: { nameUz: data.nameUz } });
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: { ...payload, doctors: { set: doctorIds } },
      });
    } else {
      await prisma.service.create({ data: { ...payload, doctors: { connect: doctorIds } } });
    }
  }
  console.log(`  ${SERVICES.length} ta xizmat`);

  // ── SUPERADMIN ──
  const passwordHash = await bcrypt.hash(config.auth.superadminPassword, 10);
  await prisma.adminUser.upsert({
    where: { login: config.auth.superadminLogin },
    update: { passwordHash, role: 'SUPERADMIN', isActive: true },
    create: {
      login: config.auth.superadminLogin,
      passwordHash,
      fullName: 'Bosh administrator',
      role: 'SUPERADMIN',
    },
  });
  console.log(`  SUPERADMIN: ${config.auth.superadminLogin}`);

  // ── Har bir shifokor uchun DOCTOR roli ──
  for (const doc of doctors) {
    const login = `dr.${doc.lastName.toLowerCase().replace(/[^a-z]/g, '')}`;
    const hash = await bcrypt.hash('doctor12345', 10);
    await prisma.adminUser.upsert({
      where: { login },
      update: { doctorId: doc.id, role: 'DOCTOR' },
      create: {
        login,
        passwordHash: hash,
        fullName: `${doc.firstName} ${doc.lastName}`,
        role: 'DOCTOR',
        doctorId: doc.id,
      },
    });
  }
  console.log('  Shifokorlar uchun panel loginlari (parol: doctor12345)');

  console.log('Seed tugadi.');
}

main()
  .catch((e) => {
    console.error('Seed xatosi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
