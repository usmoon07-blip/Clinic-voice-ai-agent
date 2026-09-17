'use strict';
/**
 * Bemorga va shifokorga yuboriladigan xabar shablonlari (uz/ru).
 * Kodga matn yozib qo'yilmasin — hammasi shu yerda.
 *
 * DISKRET REJIM: agar xizmat `isSensitive` bo'lsa yoki bemorda diskret rejim yoqilgan
 * bo'lsa, xizmat nomi xabarga YOZILMAYDI.
 */
const time = require('../utils/time');

const DISCLAIMER = {
  UZ: 'Bu xabar tibbiy maslahat emas.',
  RU: 'Это сообщение не является медицинской консультацией.',
};

/** Xizmat nomini ko'rsatish mumkinmi? */
function serviceLabel({ service, patient, lang }) {
  const hidden = service?.isSensitive || patient?.discreetMode;
  if (hidden) return null;
  return lang === 'RU' ? service?.nameRu : service?.nameUz;
}

function fmtMoney(amount, lang) {
  const n = Number(amount || 0).toLocaleString('ru-RU');
  return lang === 'RU' ? `${n} сум` : `${n} so'm`;
}

function fmtDateTime(startTime, lang) {
  return {
    date: time.formatDateHuman(startTime, lang),
    time: time.timeKey(startTime),
  };
}

/** Navbat tasdig'i — bemorga */
function bookingConfirmed({ appointment, doctor, service, room, patient, lang = 'UZ' }) {
  const { date, time: t } = fmtDateTime(appointment.startTime, lang);
  const svc = serviceLabel({ service, patient, lang });
  const doctorName = `${doctor.firstName} ${doctor.lastName}`;

  if (lang === 'RU') {
    const lines = [
      '✅ Ваша запись подтверждена.',
      `👨‍⚕️ Врач: ${doctorName}`,
      svc ? `🩺 Услуга: ${svc}` : null,
      `📅 Дата: ${date}`,
      `🕐 Время: ${t}`,
      room ? `🚪 Кабинет: ${room.name}` : null,
      `💰 Стоимость: ${fmtMoney(appointment.price, lang)}`,
      '',
      'Просим прийти за 10 минут до приёма.',
    ];
    return lines.filter(Boolean).join('\n');
  }
  const lines = [
    '✅ Navbatingiz tasdiqlandi.',
    `👨‍⚕️ Shifokor: ${doctorName}`,
    svc ? `🩺 Xizmat: ${svc}` : null,
    `📅 Sana: ${date}`,
    `🕐 Vaqt: ${t}`,
    room ? `🚪 Kabinet: ${room.name}` : null,
    `💰 Narx: ${fmtMoney(appointment.price, lang)}`,
    '',
    'Iltimos, qabuldan 10 daqiqa oldin keling.',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Navbat tasdig'i — SMS (qisqa) */
function bookingConfirmedSms({ appointment, doctor, room, clinicName, lang = 'UZ' }) {
  const { date, time: t } = fmtDateTime(appointment.startTime, lang);
  const doctorName = `${doctor.firstName} ${doctor.lastName}`;
  if (lang === 'RU') {
    return `${clinicName}: вы записаны ${date} в ${t}. Врач: ${doctorName}.${room ? ` Кабинет ${room.name}.` : ''}`;
  }
  return `${clinicName}: ${date}, soat ${t} ga yozildingiz. Shifokor: ${doctorName}.${room ? ` ${room.name}.` : ''}`;
}

/** Yangi navbat — shifokorga */
function newBookingForDoctor({ appointment, patient, service, lang = 'UZ' }) {
  const { date, time: t } = fmtDateTime(appointment.startTime, lang);
  const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
  const svc = lang === 'RU' ? service?.nameRu : service?.nameUz; // shifokorga to'liq ko'rsatiladi
  if (lang === 'RU') {
    return `🆕 Новая запись: ${patientName}, ${svc}, ${date} в ${t}.`;
  }
  return `🆕 Yangi navbat: ${patientName}, ${svc}, ${date} ${t}.`;
}

/** 24 soatlik eslatma */
function dayBeforeReminder({ appointment, doctor, service, patient, lang = 'UZ' }) {
  const { time: t } = fmtDateTime(appointment.startTime, lang);
  const doctorName = `${doctor.firstName} ${doctor.lastName}`;
  const svc = serviceLabel({ service, patient, lang });
  if (lang === 'RU') {
    return [
      `⏰ Напоминание: завтра в ${t} у вас приём.`,
      `👨‍⚕️ Врач: ${doctorName}`,
      svc ? `🩺 ${svc}` : null,
      '',
      'Если не сможете прийти — пожалуйста, отмените запись.',
    ].filter(Boolean).join('\n');
  }
  return [
    `⏰ Eslatma: ertaga soat ${t} da qabulingiz bor.`,
    `👨‍⚕️ Shifokor: ${doctorName}`,
    svc ? `🩺 ${svc}` : null,
    '',
    'Kela olmasangiz, iltimos, navbatni bekor qiling.',
  ].filter(Boolean).join('\n');
}

/** Tayyorgarlik yo'riqnomasi */
function preparationInstruction({ service, lang = 'UZ' }) {
  const text = lang === 'RU' ? service.preparationRu : service.preparationUz;
  if (!text) return null;
  const head = lang === 'RU' ? '📋 Подготовка к приёму:' : '📋 Qabulga tayyorgarlik:';
  return `${head}\n${text}\n\n${DISCLAIMER[lang]}`;
}

/** 2 soatlik eslatma */
function hourBeforeReminder({ appointment, room, lang = 'UZ' }) {
  const { time: t } = fmtDateTime(appointment.startTime, lang);
  if (lang === 'RU') {
    return `⏰ Сегодня в ${t} у вас приём.${room ? ` Кабинет ${room.name}.` : ''}`;
  }
  return `⏰ Bugun soat ${t} da qabulingiz bor.${room ? ` ${room.name}.` : ''}`;
}

/** Shifokorga kunlik ro'yxat */
function doctorDailyAgenda({ count, items, lang = 'UZ' }) {
  const head = lang === 'RU'
    ? `📋 Сегодня у вас ${count} приём(ов):`
    : `📋 Bugun sizda ${count} ta qabul bor:`;
  return [head, ...items].join('\n');
}

/** Qabuldan keyin baho so'rash */
function feedbackRequest({ doctor, lang = 'UZ' }) {
  const doctorName = `${doctor.firstName} ${doctor.lastName}`;
  return lang === 'RU'
    ? `Как прошёл приём у врача ${doctorName}? Пожалуйста, оцените ⭐`
    : `${doctorName} qabuli qanday o'tdi? Iltimos, baho bering ⭐`;
}

/** Klinika tomonidan bekor qilindi */
function cancelledByClinic({ appointment, doctor, lang = 'UZ' }) {
  const { date, time: t } = fmtDateTime(appointment.startTime, lang);
  const doctorName = `${doctor.firstName} ${doctor.lastName}`;
  if (lang === 'RU') {
    return `❗️ К сожалению, приём ${date} в ${t} (врач ${doctorName}) отменён клиникой. Пожалуйста, выберите другое время — приносим извинения.`;
  }
  return `❗️ Kechirasiz, ${date} soat ${t} dagi qabul (${doctorName}) klinika tomonidan bekor qilindi. Iltimos, boshqa vaqtni tanlang — uzr so'raymiz.`;
}

/** Bemor bekor qildi — tasdiq */
function cancelledByPatient({ appointment, lang = 'UZ' }) {
  const { date, time: t } = fmtDateTime(appointment.startTime, lang);
  return lang === 'RU'
    ? `Запись на ${date} в ${t} отменена.`
    : `${date}, soat ${t} dagi navbat bekor qilindi.`;
}

/** Kutish ro'yxati taklifi */
function waitlistOffer({ doctor, slot, minutes, link, lang = 'UZ' }) {
  const date = time.formatDateHuman(slot, lang);
  const t = time.timeKey(slot);
  const doctorName = `${doctor.firstName} ${doctor.lastName}`;
  if (lang === 'RU') {
    return `🔔 Освободилось время у врача ${doctorName}: ${date} в ${t}.\nПодтвердите в течение ${minutes} минут: ${link}`;
  }
  return `🔔 ${doctorName} qabulida joy bo'shadi: ${date}, soat ${t}.\n${minutes} daqiqa ichida tasdiqlang: ${link}`;
}

/** "Yo'ldaman" — shifokor/registraturaga */
function onTheWay({ patient, appointment, lang = 'UZ' }) {
  const { time: t } = fmtDateTime(appointment.startTime, lang);
  const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();
  return lang === 'RU'
    ? `🚗 ${patientName} уже в пути. Приём в ${t}.`
    : `🚗 ${patientName} yo'lda. Qabul soat ${t} da.`;
}

/** Navbat cheklovi (ko'p marta kelmagan bemor) */
function blockedByNoShow({ threshold, clinicPhone, lang = 'UZ' }) {
  return lang === 'RU'
    ? `Онлайн-запись временно недоступна (${threshold} пропущенных приёма). Пожалуйста, позвоните в регистратуру: ${clinicPhone}`
    : `Onlayn navbat vaqtincha cheklangan (${threshold} marta kelmagansiz). Iltimos, registraturaga qo'ng'iroq qiling: ${clinicPhone}`;
}

module.exports = {
  DISCLAIMER,
  serviceLabel,
  fmtMoney,
  bookingConfirmed,
  bookingConfirmedSms,
  newBookingForDoctor,
  dayBeforeReminder,
  preparationInstruction,
  hourBeforeReminder,
  doctorDailyAgenda,
  feedbackRequest,
  cancelledByClinic,
  cancelledByPatient,
  waitlistOffer,
  onTheWay,
  blockedByNoShow,
};
