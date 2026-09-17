import { createContext, useContext } from 'react';

export const STRINGS = {
  UZ: {
    appName: 'Klinika',
    hi: 'Assalomu alaykum',
    howCanWeHelp: 'Bugun sizga qanday yordam kerak?',
    byDoctor: 'Shifokor bo\'yicha',
    byService: 'Xizmat bo\'yicha',
    byComplaint: 'Shikoyat bo\'yicha',
    specialties: 'Yo\'nalishlar',
    doctors: 'Shifokorlar',
    popularServices: 'Ommabop xizmatlar',
    bookNow: 'Navbat oling',
    upcoming: 'Yaqinlashayotgan navbatingiz',
    home: 'Bosh sahifa',
    services: 'Xizmatlar',
    booking: 'Navbat',
    profile: 'Profil',
    price: 'Narx',
    duration: 'Davomiyligi',
    minutes: 'daqiqa',
    sum: 'so\'m',
    book: 'Navbat olish',
    preparation: 'Tayyorgarlik',
    step: 'Qadam',
    whoFor: 'Kim uchun navbat olyapsiz?',
    forMe: 'O\'zimga',
    forChild: 'Farzandimga',
    forOther: 'Boshqa odamga',
    addFamily: '+ Oila a\'zosi qo\'shish',
    chooseService: 'Xizmatni tanlang',
    chooseDoctor: 'Shifokorni tanlang',
    chooseDate: 'Sanani tanlang',
    chooseTime: 'Vaqtni tanlang',
    confirm: 'Tasdiqlash',
    confirmBooking: 'Navbatni tasdiqlash',
    femaleDoctorOnly: 'Faqat ayol shifokor',
    experience: 'yil tajriba',
    noSlots: 'Bu kunda bo\'sh joy yo\'q',
    joinWaitlist: 'Kutish ro\'yxatiga yozilish',
    waitlistAdded: 'Kutish ro\'yxatiga qo\'shildingiz. Joy bo\'shashi bilan xabar beramiz.',
    myAppointments: 'Mening navbatlarim',
    noAppointments: 'Sizda hozircha navbat yo\'q',
    cancel: 'Bekor qilish',
    reschedule: 'Ko\'chirish',
    onMyWay: 'Yo\'ldaman',
    onMyWaySent: 'Registraturaga xabar berildi ✅',
    bookAgain: 'Yana yozilish',
    firstName: 'Ism',
    lastName: 'Familiya',
    phone: 'Telefon',
    birthDate: 'Tug\'ilgan sana',
    save: 'Saqlash',
    saved: 'Saqlandi ✅',
    cardNumber: 'Kartochka raqami',
    familyMembers: 'Oila a\'zolari',
    language: 'Til',
    discreetMode: 'Diskret rejim',
    discreetHint: 'Yoqilgan bo\'lsa, SMS va Telegram xabarlarida xizmat nomi yozilmaydi',
    address: 'Manzil',
    openMap: 'Xaritada ochish',
    addToCalendar: 'Kalendarga qo\'shish',
    emergencyTitle: 'Shoshilinch holat',
    complaintPlaceholder: 'Shikoyatingizni yozing, masalan: "boshim og\'riyapti"',
    find: 'Topish',
    routedTo: 'Sizga mos yo\'nalish',
    fillProfile: 'Davom etish uchun ma\'lumotlaringizni kiriting',
    required: 'To\'ldirilishi shart',
    loading: 'Yuklanmoqda...',
    back: 'Orqaga',
    status: {
      PENDING: 'Kutilmoqda', CONFIRMED: 'Tasdiqlangan', CHECKED_IN: 'Kelgan',
      COMPLETED: 'Yakunlangan', CANCELLED: 'Bekor qilingan', NO_SHOW: 'Kelmadi',
    },
    onboarding: [
      { title: 'Sog\'ligingiz — bizning ishimiz', text: 'Malakali shifokorlar va zamonaviy diagnostika.' },
      { title: 'Shifokorni va vaqtni o\'zingiz tanlang', text: 'Bo\'sh vaqtni ko\'rib, oldindan yoziling.' },
      { title: 'Navbatda turmang', text: 'Belgilangan vaqtda keling — vaqtingizni tejang.' },
    ],
    start: 'Boshlash',
    next: 'Keyingisi',
    notMedicalAdvice: 'Bu ma\'lumot tibbiy maslahat emas.',
  },
  RU: {
    appName: 'Клиника',
    hi: 'Здравствуйте',
    howCanWeHelp: 'Чем мы можем помочь сегодня?',
    byDoctor: 'По врачу',
    byService: 'По услуге',
    byComplaint: 'По жалобе',
    specialties: 'Направления',
    doctors: 'Врачи',
    popularServices: 'Популярные услуги',
    bookNow: 'Записаться',
    upcoming: 'Ближайшая запись',
    home: 'Главная',
    services: 'Услуги',
    booking: 'Запись',
    profile: 'Профиль',
    price: 'Цена',
    duration: 'Длительность',
    minutes: 'мин',
    sum: 'сум',
    book: 'Записаться',
    preparation: 'Подготовка',
    step: 'Шаг',
    whoFor: 'Для кого запись?',
    forMe: 'Для себя',
    forChild: 'Для ребёнка',
    forOther: 'Для другого',
    addFamily: '+ Добавить члена семьи',
    chooseService: 'Выберите услугу',
    chooseDoctor: 'Выберите врача',
    chooseDate: 'Выберите дату',
    chooseTime: 'Выберите время',
    confirm: 'Подтвердить',
    confirmBooking: 'Подтвердить запись',
    femaleDoctorOnly: 'Только женщина-врач',
    experience: 'лет опыта',
    noSlots: 'На этот день свободных мест нет',
    joinWaitlist: 'В лист ожидания',
    waitlistAdded: 'Вы в листе ожидания. Сообщим, как освободится место.',
    myAppointments: 'Мои записи',
    noAppointments: 'У вас пока нет записей',
    cancel: 'Отменить',
    reschedule: 'Перенести',
    onMyWay: 'Я в пути',
    onMyWaySent: 'Регистратура уведомлена ✅',
    bookAgain: 'Записаться снова',
    firstName: 'Имя',
    lastName: 'Фамилия',
    phone: 'Телефон',
    birthDate: 'Дата рождения',
    save: 'Сохранить',
    saved: 'Сохранено ✅',
    cardNumber: 'Номер карты',
    familyMembers: 'Члены семьи',
    language: 'Язык',
    discreetMode: 'Деликатный режим',
    discreetHint: 'Если включено, название услуги не пишется в SMS и Telegram',
    address: 'Адрес',
    openMap: 'Открыть на карте',
    addToCalendar: 'Добавить в календарь',
    emergencyTitle: 'Неотложное состояние',
    complaintPlaceholder: 'Опишите жалобу, например: «болит голова»',
    find: 'Найти',
    routedTo: 'Подходящее направление',
    fillProfile: 'Заполните данные, чтобы продолжить',
    required: 'Обязательное поле',
    loading: 'Загрузка...',
    back: 'Назад',
    status: {
      PENDING: 'Ожидает', CONFIRMED: 'Подтверждена', CHECKED_IN: 'Пришёл',
      COMPLETED: 'Завершена', CANCELLED: 'Отменена', NO_SHOW: 'Не пришёл',
    },
    onboarding: [
      { title: 'Ваше здоровье — наша работа', text: 'Квалифицированные врачи и современная диагностика.' },
      { title: 'Выбирайте врача и время сами', text: 'Смотрите свободные окна и записывайтесь заранее.' },
      { title: 'Не стойте в очереди', text: 'Приходите к назначенному времени.' },
    ],
    start: 'Начать',
    next: 'Далее',
    notMedicalAdvice: 'Эта информация не является медицинской консультацией.',
  },
};

export const LangContext = createContext({ lang: 'UZ', setLang: () => {}, t: STRINGS.UZ });
export const useLang = () => useContext(LangContext);

/** Xizmat/shifokor nomini tilga qarab olish. */
export const localized = (obj, field, lang) => (lang === 'RU' ? obj?.[`${field}Ru`] : obj?.[`${field}Uz`]) || '';

export const money = (value, lang) =>
  `${Number(value || 0).toLocaleString('ru-RU')} ${lang === 'RU' ? 'сум' : "so'm"}`;

/* ── Sana/vaqt formatlash ──────────────────────────────────────────
   Klinika Toshkentda — vaqt har doim Asia/Tashkent bo'yicha ko'rsatiladi
   (bemor boshqa vaqt zonasida bo'lsa ham to'g'ri ko'rinadi).
   uz-UZ lokali oy nomlarini "M09" ko'rinishida beradi, shuning uchun
   o'zbekcha oylar qo'lda yoziladi.                                     */

export const TZ = 'Asia/Tashkent';

const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const WEEKDAYS_UZ = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba',
  'payshanba', 'juma', 'shanba'];

const partsInTz = (value) => {
  const d = new Date(value);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    day: Number(parts.day),
    month: Number(parts.month),
    year: Number(parts.year),
    hour: parts.hour,
    minute: parts.minute,
    weekdayIndex: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
  };
};

/** "21-sentyabr" / "21 сентября" */
export function formatDate(value, lang, { withWeekday = false } = {}) {
  const p = partsInTz(value);
  if (lang === 'RU') {
    const base = new Intl.DateTimeFormat('ru-RU', {
      timeZone: TZ, day: 'numeric', month: 'long', ...(withWeekday ? { weekday: 'long' } : {}),
    }).format(new Date(value));
    return base;
  }
  const base = `${p.day}-${MONTHS_UZ[p.month - 1]}`;
  return withWeekday ? `${base}, ${WEEKDAYS_UZ[p.weekdayIndex]}` : base;
}

/** "09:35" (Toshkent vaqti) */
export function formatTime(value) {
  const p = partsInTz(value);
  return `${p.hour}:${p.minute}`;
}

/** "21-sentyabr, 09:35" */
export function formatDateTime(value, lang) {
  return `${formatDate(value, lang)}, ${formatTime(value)}`;
}

/** Qisqa sana tugmalari uchun: "21-sen" / "21 сен" */
export function formatDateShort(value, lang) {
  const p = partsInTz(value);
  if (lang === 'RU') {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: 'numeric', month: 'short' }).format(new Date(value));
  }
  return `${p.day}-${MONTHS_UZ[p.month - 1].slice(0, 3)}`;
}
