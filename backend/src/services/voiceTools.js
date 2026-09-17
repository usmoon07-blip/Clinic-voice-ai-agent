'use strict';
/**
 * AI Voice Agent uchun tool (function calling) ta'riflari va amalga oshirilishi.
 *
 * AI FAQAT shu funksiyalar orqali ish ko'radi — narx, bo'sh vaqt, shifokor ismi
 * yoki kabinetni o'zidan to'qib chiqara olmaydi.
 */
const { prisma } = require('../database/connection');
const availability = require('./availabilityService');
const bookingService = require('./bookingService');
const cancellationPolicy = require('./cancellationPolicyService');
const identityService = require('./identityService');
const waitlistService = require('./waitlistService');
const settingsService = require('./settingsService');
const smsService = require('./smsService');
const triage = require('./triageService');
const config = require('../config/default');
const time = require('../utils/time');
const phoneUtil = require('../utils/phone');

/** Til bo'yicha nomni tanlash. */
const pick = (obj, lang, field) => (lang === 'RU' ? obj[`${field}Ru`] : obj[`${field}Uz`]);

/** AI ga beriladigan tool ta'riflari (Anthropic formati). */
const TOOL_DEFINITIONS = [
  {
    name: 'find_specialty',
    description:
      "Bemorning shikoyati yoki so'zi bo'yicha mos mutaxassislikni va xizmatni topadi. "
      + 'Bu lug\'at asosidagi marshrutlash, TASHXIS EMAS. '
      + 'Bemor "terapevtga yozilmoqchiman" desa ham, "bosh og\'riyapti" desa ham shuni chaqir.',
    input_schema: {
      type: 'object',
      properties: {
        complaint_text: { type: 'string', description: 'Bemor aytgan matn' },
        patient_age: { type: 'number', description: 'Bemor yoshi (bilinsa)' },
      },
      required: ['complaint_text'],
    },
  },
  {
    name: 'list_services',
    description: 'Mutaxassislik bo\'yicha faol xizmatlar va ularning narxlarini qaytaradi.',
    input_schema: {
      type: 'object',
      properties: {
        specialty_id: { type: 'number' },
        query: { type: 'string', description: 'Xizmat nomi bo\'yicha qidiruv (ixtiyoriy)' },
      },
    },
  },
  {
    name: 'list_doctors',
    description: 'Mos shifokorlar ro\'yxati. Faqat kalendari OCHIQ shifokorlar qaytadi.',
    input_schema: {
      type: 'object',
      properties: {
        specialty_id: { type: 'number' },
        service_id: { type: 'number' },
        gender: { type: 'string', enum: ['MALE', 'FEMALE'], description: 'Bemor "ayol shifokor" so\'rasa FEMALE' },
        patient_age: { type: 'number' },
      },
    },
  },
  {
    name: 'get_available_slots',
    description:
      'HAQIQIY bo\'sh vaqtlarni qaytaradi (shifokor, kabinet, davomiylik hisobga olingan). '
      + 'Bemorga vaqt taklif qilishdan oldin HAR DOIM shuni chaqir. '
      + 'Sanani "2026-09-18" ko\'rinishida yoki "ertaga"/"завтра" deb ham berish mumkin.',
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'number' },
        doctor_id: { type: 'number' },
        specialty_id: { type: 'number' },
        date_from: { type: 'string', description: '"2026-09-18" yoki "ertaga"' },
        date_to: { type: 'string' },
        part_of_day: { type: 'string', enum: ['morning', 'afternoon', 'any'] },
        patient_age: { type: 'number' },
      },
      required: ['service_id'],
    },
  },
  {
    name: 'find_patient_by_phone',
    description: 'Telefon raqami bo\'yicha bemorni qidiradi. Ismi bazada bo\'lsa qayta so\'rashning hojati yo\'q.',
    input_schema: {
      type: 'object',
      properties: { phone: { type: 'string' } },
      required: ['phone'],
    },
  },
  {
    name: 'verify_patient_identity',
    description:
      'MAVJUD navbat ma\'lumotini aytish, ko\'chirish yoki bekor qilishdan OLDIN majburiy. '
      + 'Bemordan familiyasi yoki tug\'ilgan yilini so\'rab, shu funksiyaga uzat.',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        name_or_birth_year: { type: 'string', description: 'Familiya yoki tug\'ilgan yil' },
      },
      required: ['phone', 'name_or_birth_year'],
    },
  },
  {
    name: 'create_patient',
    description: 'Yangi bemor yaratadi. Bola uchun bo\'lsa is_child=true va guardian_phone ko\'rsatiladi.',
    input_schema: {
      type: 'object',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        phone: { type: 'string' },
        birth_date: { type: 'string', description: 'YYYY-MM-DD' },
        birth_year: { type: 'number' },
        is_child: { type: 'boolean' },
        guardian_phone: { type: 'string' },
      },
      required: ['first_name', 'phone'],
    },
  },
  {
    name: 'create_appointment',
    description:
      'Navbatni yaratadi. Faqat bemor hamma narsani OG\'ZAKI TASDIQLAGANDAN keyin chaqir. '
      + 'start_time — get_available_slots qaytargan aniq qiymat bo\'lishi shart.',
    input_schema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number' },
        doctor_id: { type: 'number' },
        service_id: { type: 'number' },
        start_time: { type: 'string', description: 'ISO vaqt (slotdan olingan)' },
      },
      required: ['patient_id', 'doctor_id', 'service_id', 'start_time'],
    },
  },
  {
    name: 'get_patient_appointments',
    description: 'Bemorning navbatlari. FAQAT verify_patient_identity muvaffaqiyatli bo\'lgandan keyin ishlaydi.',
    input_schema: {
      type: 'object',
      properties: { patient_id: { type: 'number' } },
      required: ['patient_id'],
    },
  },
  {
    name: 'reschedule_appointment',
    description: 'Navbatni boshqa vaqtga ko\'chiradi (bekor qilish oynasi qoidasi tekshiriladi).',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'number' },
        new_start_time: { type: 'string' },
      },
      required: ['appointment_id', 'new_start_time'],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Navbatni bekor qiladi. Qabulgacha belgilangan vaqtdan kam qolgan bo\'lsa, tizim rad etadi.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'number' },
        reason: { type: 'string' },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'add_to_waitlist',
    description: 'Bo\'sh joy bo\'lmasa, bemorni kutish ro\'yxatiga qo\'shadi. Joy bo\'shasa unga xabar boradi.',
    input_schema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number' },
        service_id: { type: 'number' },
        doctor_id: { type: 'number' },
        date_from: { type: 'string' },
        date_to: { type: 'string' },
        part_of_day: { type: 'string', enum: ['morning', 'afternoon', 'any'] },
      },
      required: ['patient_id', 'service_id'],
    },
  },
  {
    name: 'get_clinic_info',
    description: 'Klinika manzili, ish vaqti, mo\'ljal va telefon raqami.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_preparation_instructions',
    description: 'Xizmatga tayyorgarlik qoidalari (och qorin, suv ichish va h.k.).',
    input_schema: {
      type: 'object',
      properties: { service_id: { type: 'number' } },
      required: ['service_id'],
    },
  },
  {
    name: 'transfer_to_operator',
    description:
      'Qo\'ng\'iroqni operatorga uzatadi. Shoshilinch holat, tibbiy savol, shikoyat, '
      + '2 marta tushunmovchilik yoki bemor so\'rasa — darhol chaqir.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: ['EMERGENCY', 'MEDICAL_QUESTION', 'COMPLAINT', 'MISUNDERSTOOD', 'PATIENT_REQUEST', 'SYSTEM_ERROR'] },
      },
      required: ['reason'],
    },
  },
  {
    name: 'send_sms_link',
    description: 'Bemorga SMS yuboradi: Mini App havolasi yoki klinika manzili.',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        type: { type: 'string', enum: ['MINIAPP', 'ADDRESS'] },
      },
      required: ['phone', 'type'],
    },
  },
  {
    name: 'end_call',
    description: 'Suhbat yakunlanganda qo\'ng\'iroqni xayrlashib tugatadi.',
    input_schema: {
      type: 'object',
      properties: { summary: { type: 'string' } },
    },
  },
];

// ─────────────────────────── AMALGA OSHIRISH ───────────────────────────

const handlers = {
  async find_specialty({ complaint_text, patient_age }, session) {
    const emergency = triage.detectEmergency(complaint_text);
    if (emergency.isEmergency) {
      session.emergency = true;
      return { emergency: true, instruction: 'Darhol transfer_to_operator ni EMERGENCY sababi bilan chaqir.' };
    }

    const routed = await triage.routeToSpecialty(complaint_text, patient_age ?? session.patientAge ?? null);
    if (!routed.specialty) {
      return { found: false, hint: 'Mutaxassislik aniqlanmadi. Bemordan qaysi shifokorga yozilmoqchiligini so\'ra.' };
    }

    const services = await prisma.service.findMany({
      where: { isActive: true, specialtyId: routed.specialty.id },
      select: { id: true, nameUz: true, nameRu: true, price: true, durationMinutes: true },
      take: 5,
    });

    return {
      found: true,
      specialty: {
        id: routed.specialty.id,
        name: pick(routed.specialty, session.language, 'name'),
      },
      services: services.map((s) => ({
        id: s.id, name: pick(s, session.language, 'name'), price: s.price, duration_minutes: s.durationMinutes,
      })),
      alternatives: routed.alternatives.map((a) => ({ id: a.id, name: pick(a, session.language, 'name') })),
    };
  },

  async list_services({ specialty_id, query }, session) {
    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        ...(specialty_id ? { specialtyId: Number(specialty_id) } : {}),
        ...(query
          ? { OR: [
              { nameUz: { contains: query, mode: 'insensitive' } },
              { nameRu: { contains: query, mode: 'insensitive' } },
              { aliases: { has: String(query).toLowerCase() } },
            ] }
          : {}),
      },
      take: 12,
    });
    return {
      services: services.map((s) => ({
        id: s.id,
        name: pick(s, session.language, 'name'),
        price: s.price,
        duration_minutes: s.durationMinutes,
        needs_preparation: Boolean(s.preparationUz || s.preparationRu),
      })),
    };
  },

  async list_doctors({ specialty_id, service_id, gender, patient_age }, session) {
    const doctors = await prisma.doctor.findMany({
      where: {
        isActive: true,
        calendarStatus: 'OPEN',
        ...(specialty_id ? { specialtyId: Number(specialty_id) } : {}),
        ...(gender ? { gender } : {}),
        ...(service_id ? { services: { some: { id: Number(service_id) } } } : {}),
      },
      include: { specialty: true },
      take: 8,
    });
    const age = patient_age ?? session.patientAge ?? null;
    const fitting = doctors.filter((d) => availability.ageFits(age, d.minAge, d.maxAge));
    return {
      doctors: fitting.map((d) => ({
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
        specialty: pick(d.specialty, session.language, 'name'),
        gender: d.gender,
        experience_years: d.experienceYears,
      })),
    };
  },

  async get_available_slots(input, session) {
    const dateFrom = time.parseSpokenDate(input.date_from) || input.date_from || time.dateKey(new Date());
    const dateTo = time.parseSpokenDate(input.date_to) || input.date_to || dateFrom;

    const { slots, reason } = await availability.getAvailableSlots({
      serviceId: Number(input.service_id),
      doctorId: input.doctor_id ? Number(input.doctor_id) : undefined,
      specialtyId: input.specialty_id ? Number(input.specialty_id) : undefined,
      dateFrom,
      dateTo,
      patientAge: input.patient_age ?? session.patientAge ?? null,
      patientId: session.knownPatientId || session.verifiedPatientId || null,
      limit: 60,
    });

    let filtered = slots;
    if (input.part_of_day === 'morning') filtered = slots.filter((s) => Number(s.time.slice(0, 2)) < 13);
    if (input.part_of_day === 'afternoon') filtered = slots.filter((s) => Number(s.time.slice(0, 2)) >= 13);

    // AI keyin aynan shu slotdan foydalanishi uchun sessiyada saqlaymiz
    session.lastSlots = filtered.slice(0, 12);

    if (filtered.length === 0) {
      return {
        slots: [],
        reason: reason || 'NO_SLOTS',
        hint: 'Bo\'sh joy yo\'q. Boshqa kunni taklif qil yoki add_to_waitlist ni taklif qil.',
      };
    }

    return {
      slots: filtered.slice(0, 6).map((s) => ({
        start_time: s.startUtc.toISOString(),
        date_human: time.formatDateHuman(s.startUtc, session.language),
        time: s.time,
        doctor_id: s.doctorId,
        doctor_name: s.doctorName,
        room: s.roomName,
        price: s.price,
        duration_minutes: s.durationMinutes,
      })),
      total_found: filtered.length,
    };
  },

  async find_patient_by_phone({ phone }, session) {
    const patient = await identityService.findByPhone(phone || session.callerPhone);
    if (!patient) return { found: false };
    session.knownPatientId = patient.id;
    return {
      found: true,
      patient_id: patient.id,
      first_name: patient.firstName,
      // Familiya to'liq aytilmaydi — shaxs tasdiqlanmagan bo'lishi mumkin
      has_family_members: (patient.familyMembers || []).length > 0,
      is_blocked: patient.isBlacklisted,
    };
  },

  async verify_patient_identity({ phone, name_or_birth_year }, session) {
    const result = await identityService.verify({
      phone: phone || session.callerPhone,
      nameOrBirthYear: name_or_birth_year,
    });
    if (result.verified) {
      session.verifiedPatientId = result.patient.id;
      session.patientAge = availability.ageFromBirthDate(result.patient.birthDate);
      return { verified: true, patient_id: result.patient.id, full_name: `${result.patient.firstName} ${result.patient.lastName || ''}`.trim() };
    }
    return {
      verified: false,
      reason: result.reason,
      hint: result.reason === 'MISMATCH'
        ? 'Ma\'lumot mos kelmadi. Hech narsa aytma, transfer_to_operator ni chaqir.'
        : 'Bemor topilmadi yoki javob yetarli emas.',
    };
  },

  async create_patient(input, session) {
    const phone = input.is_child && input.guardian_phone ? input.guardian_phone : (input.phone || session.callerPhone);
    const birthDate = input.birth_date
      || (input.birth_year ? `${input.birth_year}-01-01` : null);

    if (input.is_child) {
      let guardian = await identityService.findByPhone(phone);
      if (!guardian) {
        guardian = await bookingService.findOrCreatePatient({
          phone,
          firstName: 'Ota-ona',
          source: 'VOICE',
          language: session.language,
        });
      }
      const child = await bookingService.createFamilyMember({
        guardianId: guardian.id,
        firstName: input.first_name,
        lastName: input.last_name || null,
        birthDate,
        relation: 'CHILD',
      });
      session.knownPatientId = child.id;
      session.patientAge = availability.ageFromBirthDate(child.birthDate);
      return { patient_id: child.id, guardian_id: guardian.id, is_child: true };
    }

    const patient = await bookingService.findOrCreatePatient({
      phone,
      firstName: input.first_name,
      lastName: input.last_name || null,
      birthDate,
      source: 'VOICE',
      language: session.language,
    });
    session.knownPatientId = patient.id;
    session.patientAge = availability.ageFromBirthDate(patient.birthDate);
    return { patient_id: patient.id, is_child: false };
  },

  async create_appointment(input, session) {
    try {
      const { appointment, duplicate } = await bookingService.createAppointment({
        patientId: Number(input.patient_id),
        doctorId: Number(input.doctor_id),
        serviceId: Number(input.service_id),
        startTime: new Date(input.start_time),
        source: 'VOICE',
        bookedByPhone: session.callerPhone,
        isUrgent: Boolean(session.urgent),
        urgentReason: session.urgentReason || null,
        // Bir qo'ng'iroq ichida ikki marta chaqirilsa, ikkita navbat yaratilmasin
        idempotencyKey: `voice:${session.callSid}:${input.doctor_id}:${input.start_time}`,
      });

      session.createdAppointmentId = appointment.id;

      const full = await prisma.appointment.findUnique({
        where: { id: appointment.id },
        include: { doctor: true, service: true, room: true },
      });

      return {
        success: true,
        duplicate,
        appointment_id: full.id,
        date_human: time.formatDateHuman(full.startTime, session.language),
        time: time.timeKey(full.startTime),
        doctor_name: `${full.doctor.firstName} ${full.doctor.lastName}`,
        room: full.room?.name || null,
        price: full.price,
        preparation: pick(full.service, session.language, 'preparation') || null,
      };
    } catch (e) {
      return {
        success: false,
        error: e.code || 'ERROR',
        hint: e.code === 'SLOT_TAKEN'
          ? 'Bu vaqt band bo\'lib qoldi. get_available_slots ni qayta chaqirib, boshqa vaqt taklif qil.'
          : (e.code === 'NO_SHOW_LIMIT' || e.code === 'BLACKLISTED')
            ? 'Bemorga onlayn navbat cheklangan. transfer_to_operator ni chaqir.'
            : 'Navbat yaratilmadi. Boshqa vaqt taklif qil yoki operatorga uzat.',
      };
    }
  },

  async get_patient_appointments({ patient_id }, session) {
    if (session.verifiedPatientId !== Number(patient_id)) {
      return { error: 'NOT_VERIFIED', hint: 'Avval verify_patient_identity ni chaqir.' };
    }
    const ids = [Number(patient_id)];
    const family = await prisma.patient.findMany({ where: { guardianId: Number(patient_id) }, select: { id: true } });
    ids.push(...family.map((f) => f.id));

    const appointments = await prisma.appointment.findMany({
      where: { patientId: { in: ids }, status: { in: ['PENDING', 'CONFIRMED'] }, startTime: { gte: new Date() } },
      include: { doctor: true, service: true, room: true, patient: true },
      orderBy: { startTime: 'asc' },
      take: 5,
    });

    return {
      appointments: appointments.map((a) => ({
        appointment_id: a.id,
        for_patient: a.patient.firstName,
        date_human: time.formatDateHuman(a.startTime, session.language),
        time: time.timeKey(a.startTime),
        doctor_name: `${a.doctor.firstName} ${a.doctor.lastName}`,
        service: pick(a.service, session.language, 'name'),
        room: a.room?.name || null,
      })),
    };
  },

  async reschedule_appointment({ appointment_id, new_start_time }, session) {
    const appointment = await prisma.appointment.findUnique({ where: { id: Number(appointment_id) } });
    if (!appointment) return { success: false, error: 'NOT_FOUND' };
    if (session.verifiedPatientId !== appointment.patientId) {
      const family = await prisma.patient.findFirst({
        where: { id: appointment.patientId, guardianId: session.verifiedPatientId || -1 },
      });
      if (!family) return { success: false, error: 'NOT_VERIFIED', hint: 'Avval verify_patient_identity ni chaqir.' };
    }
    try {
      const updated = await bookingService.rescheduleAppointment({
        appointmentId: Number(appointment_id),
        newStartTime: new Date(new_start_time),
        actor: 'PATIENT',
      });
      return {
        success: true,
        date_human: time.formatDateHuman(updated.startTime, session.language),
        time: time.timeKey(updated.startTime),
      };
    } catch (e) {
      return {
        success: false,
        error: e.code,
        message: e.message,
        hint: e.code === 'WINDOW_PASSED' ? 'Muddat o\'tgan — operatorga uzat.' : 'Boshqa vaqt taklif qil.',
      };
    }
  },

  async cancel_appointment({ appointment_id, reason }, session) {
    const appointment = await prisma.appointment.findUnique({ where: { id: Number(appointment_id) } });
    if (!appointment) return { success: false, error: 'NOT_FOUND' };
    if (session.verifiedPatientId !== appointment.patientId) {
      const family = await prisma.patient.findFirst({
        where: { id: appointment.patientId, guardianId: session.verifiedPatientId || -1 },
      });
      if (!family) return { success: false, error: 'NOT_VERIFIED', hint: 'Avval verify_patient_identity ni chaqir.' };
    }

    const policy = await cancellationPolicy.canCancel(appointment, { actor: 'PATIENT' });
    if (!policy.allowed) {
      return {
        success: false,
        error: policy.reason,
        say_this: cancellationPolicy.explain(policy, session.language),
        hint: 'Shu matnni ayt va transfer_to_operator ni chaqir.',
      };
    }

    await bookingService.cancelAppointment({
      appointmentId: Number(appointment_id),
      actor: 'PATIENT',
      reason: reason || 'Telefon orqali bekor qilindi',
    });
    session.outcome = 'CANCELLED';
    return { success: true };
  },

  async add_to_waitlist(input, session) {
    const entry = await waitlistService.add({
      patientId: Number(input.patient_id),
      serviceId: input.service_id ? Number(input.service_id) : null,
      doctorId: input.doctor_id ? Number(input.doctor_id) : null,
      dateFrom: time.parseSpokenDate(input.date_from) || input.date_from || new Date(),
      dateTo: time.parseSpokenDate(input.date_to) || input.date_to || new Date(Date.now() + 14 * 86400000),
      preferredPartOfDay: input.part_of_day || 'any',
    });
    session.outcome = 'NOT_BOOKED';
    return { success: true, waitlist_id: entry.id };
  },

  async get_clinic_info(_input, session) {
    const s = await settingsService.getSettings();
    return {
      name: s.clinicName,
      address: s.address,
      landmark: s.landmark,
      working_hours: s.workingHoursText,
      phone: s.phone,
      emergency_phone: s.emergencyPhone,
    };
  },

  async get_preparation_instructions({ service_id }, session) {
    const service = await prisma.service.findUnique({ where: { id: Number(service_id) } });
    if (!service) return { found: false };
    const text = pick(service, session.language, 'preparation');
    return { found: Boolean(text), instructions: text || null };
  },

  async transfer_to_operator({ reason }, session) {
    session.transferRequested = true;
    session.transferReason = reason;
    session.outcome = reason === 'EMERGENCY' ? 'EMERGENCY' : 'ESCALATED';
    return { transferring: true, say_goodbye: true };
  },

  async send_sms_link({ phone, type }, session) {
    const s = await settingsService.getSettings();
    const target = phoneUtil.normalize(phone || session.callerPhone);
    const text = type === 'ADDRESS'
      ? `${s.clinicName}: ${s.address}${s.landmark ? ` (${s.landmark})` : ''}`
      : `${s.clinicName}: navbatingizni shu yerdan boshqaring — ${config.telegram.miniAppUrl || config.publicUrl}`;
    const result = await smsService.send(target, text);
    return { sent: result.sent };
  },

  async end_call({ summary }, session) {
    session.shouldEnd = true;
    if (summary) session.summary = summary;
    return { ended: true };
  },
};

/**
 * Tool ni bajarish.
 * @returns {Promise<Object>} AI ga qaytariladigan natija
 */
async function execute(name, input, session) {
  const handler = handlers[name];
  if (!handler) return { error: 'UNKNOWN_TOOL' };
  try {
    return await handler(input || {}, session);
  } catch (e) {
    return { error: e.code || 'TOOL_ERROR', message: e.message };
  }
}

module.exports = { TOOL_DEFINITIONS, execute, handlers };
