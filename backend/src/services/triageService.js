'use strict';
/**
 * TRIAJ: shoshilinch holat belgilarini aniqlash va mutaxassisga yo'naltirish.
 *
 * MUHIM: bu TASHXIS EMAS. Bu shunchaki kalit so'zlar lug'ati:
 *  - xavfli belgi topilsa -> navbat olish to'xtatiladi, 103 va operator;
 *  - oddiy shikoyat bo'lsa -> mos mutaxassislik taklif qilinadi.
 */
const { prisma } = require('../database/connection');

// Hayot uchun xavfli bo'lishi mumkin bo'lgan belgilar (uz + ru)
const EMERGENCY_PATTERNS = [
  // Yurak / nafas
  "ko'krak og'ri", 'kokragi ogri', "ko'kragim og'ri", 'yurak tutdi', 'yurak xuruji',
  'nafas ol', 'nafasi qis', 'nafasim qis', "bo'g'il",
  'боль в груди', 'болит грудь', 'сердечный приступ', 'задыха', 'не дышит', 'одышка сильная',
  // Ong / insult
  'hushidan ket', 'hushini yo\'qot', 'hushsiz', 'behush',
  'gapira olmayapti', 'tili tortish', 'yuzi qiyshay', 'falaj', 'qo\'li ishlamay',
  'потерял сознание', 'без сознания', 'обморок', 'не может говорить', 'парализ', 'инсульт',
  // Qon ketish / jarohat
  'qon ket', 'qon oqyapti', 'ko\'p qon', 'jiddiy jaroh', 'avariya', 'yiqilib tush',
  'кровотечение', 'сильно кровит', 'травма', 'авария', 'упал с высоты',
  // Talvasa / harorat
  'talvasa', 'tutqanoq', 'titrab qol',
  'судорог', 'приступ эпилепс',
  // Zaharlanish
  'zaharlan', 'dori ichib qo\'y', 'kimyoviy',
  'отравил', 'выпил таблетки', 'передозиров',
  // Ruhiy holat
  'o\'zimni o\'ldir', 'jonimga qasd', 'yashagim kelmayapti',
  'покончить с собой', 'суицид', 'не хочу жить',
  // Bolalar
  'chaqaloq nafas', 'bolam hushsiz', 'bola talvasa',
  'ребенок не дышит', 'ребёнок без сознания', 'судороги у ребенка',
];

// Bolalarda yuqori harorat — alohida tekshiriladi
const HIGH_FEVER_PATTERNS = [/(\d{2}(?:[.,]\d)?)\s*(?:daraja|градус|°)/i];

/**
 * Matnni solishtirishga tayyorlash: apostroflar olib tashlanadi
 * ("ko'krak" -> "kokrak"), chunki STT ularni turlicha yozadi.
 */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BB\u02BC'`\u00B4]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Juftlik qoidalari: bitta iborada tana a'zosi VA og'riq/holat so'zi
 * birga uchrasa — shoshilinch. Bu "ko'kragi QATTIQ og'riyapti" kabi
 * orasiga so'z qo'shilgan gaplarni ham tutadi.
 */
const EMERGENCY_COMBINATIONS = [
  {
    name: 'chest',
    parts: ['kokrak', 'kokrag', 'grud', 'груд', 'yurak', 'сердц', 'serdc'],
    with: ['ogri', 'ogrи', 'sanch', 'bol', 'бол', 'davit', 'давит', 'жж', 'tutdi', 'xuruj', 'прихват', 'siqil'],
  },
  {
    name: 'breathing',
    parts: ['nafas', 'дыш', 'дых'],
    with: ['qis', 'ololmay', 'ola olmay', 'yetmay', 'не', 'тяжел', 'sekin'],
  },
  {
    name: 'consciousness',
    parts: ['hush', 'ong', 'созна'],
    with: ['ket', 'yoqot', 'yo`qot', 'yoq', 'poter', 'потер', 'без'],
  },
  {
    name: 'bleeding',
    // "qon" juda keng tarqalgan so'z ("qon tahlili"), shuning uchun faqat
    // qon KETAYOTGANINI bildiruvchi shakllar hisobga olinadi.
    parts: ['qon', 'кров'],
    with: ['ketyap', 'ketayap', 'ketvot', 'ketmoqda', 'oqyap', 'oqayap', 'oqmoqda',
      'toxtamay', 'toxtatolmay', 'кровотеч', 'кровит', 'идет кров', 'хлещ'],
    // Laboratoriya konteksti bo'lsa — bu shoshilinch emas
    unless: ['tahlil', 'analiz', 'анализ', 'topshir', 'сдать', 'sdat', 'laborator'],
  },
];

/** Ikkita so'z guruhi matnda bir-biridan PROXIMITY belgidan yaqin turibdimi? */
const PROXIMITY = 25;

function indexesOf(text, needle) {
  const out = [];
  let from = 0;
  for (;;) {
    const i = text.indexOf(needle, from);
    if (i === -1) return out;
    out.push(i);
    from = i + 1;
  }
}

function nearby(text, groupA, groupB) {
  for (const a of groupA) {
    const aWord = normalize(a);
    if (!aWord) continue;
    for (const ai of indexesOf(text, aWord)) {
      for (const b of groupB) {
        const bWord = normalize(b);
        if (!bWord) continue;
        for (const bi of indexesOf(text, bWord)) {
          if (Math.abs(bi - ai) <= PROXIMITY) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Shoshilinch holat belgisi bormi?
 * @returns {{isEmergency: boolean, matched: string[]}}
 */
function detectEmergency(text) {
  const t = normalize(text);
  if (!t) return { isEmergency: false, matched: [] };

  const matched = EMERGENCY_PATTERNS.filter((p) => t.includes(normalize(p)));

  // Juftlik qoidalari — so'zlar bir-biriga YAQIN turishi shart.
  // Aks holda "qon tahlili ... ketaman" kabi oddiy gap shoshilinch deb belgilanardi.
  for (const combo of EMERGENCY_COMBINATIONS) {
    const excluded = (combo.unless || []).some((w) => t.includes(normalize(w)));
    if (!excluded && nearby(t, combo.parts, combo.with)) matched.push(`combo:${combo.name}`);
  }

  // 39.5+ daraja harorat + bola -> shoshilinch
  for (const re of HIGH_FEVER_PATTERNS) {
    const m = t.match(re);
    if (m) {
      const value = parseFloat(String(m[1]).replace(',', '.'));
      const aboutChild = /bola|chaqaloq|go'dak|ребен|ребён|малыш/.test(t);
      if (value >= 39.5 && aboutChild) matched.push(`fever:${value}`);
    }
  }

  return { isEmergency: matched.length > 0, matched };
}

/**
 * Shikoyat matnidan mos mutaxassislikni topish (lug'at asosida).
 * @param {string} text
 * @param {number|null} patientAge
 * @returns {Promise<{specialty: Object|null, score: number, alternatives: Array}>}
 */
async function routeToSpecialty(text, patientAge = null) {
  const t = normalize(text);
  if (!t) return { specialty: null, score: 0, alternatives: [] };

  const specialties = await prisma.specialty.findMany({ where: { isActive: true } });

  const scored = specialties
    .map((spec) => {
      let score = 0;
      for (const alias of spec.symptomAliases || []) {
        const a = normalize(alias);
        if (a && t.includes(a)) score += a.length; // uzunroq moslik ishonchliroq
      }
      if (normalize(spec.nameUz).length && t.includes(normalize(spec.nameUz))) score += 50;
      if (normalize(spec.nameRu).length && t.includes(normalize(spec.nameRu))) score += 50;
      return { spec, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Bola bo'lsa, pediatrga ustunlik beriladi (LOR/jarroh kabi aniq moslik bo'lmasa)
  if (patientAge !== null && patientAge < 18) {
    const pediatric = specialties.find((s) => /pediatr|педиатр/i.test(s.nameUz + s.nameRu));
    if (pediatric) {
      const top = scored[0];
      if (!top || top.score < 12) {
        return { specialty: pediatric, score: 10, alternatives: scored.slice(0, 3).map((s) => s.spec) };
      }
    }
  }

  if (scored.length === 0) return { specialty: null, score: 0, alternatives: [] };
  return {
    specialty: scored[0].spec,
    score: scored[0].score,
    alternatives: scored.slice(1, 3).map((s) => s.spec),
  };
}

/** Tibbiy maslahat so'ralganini aniqlash (AI rad etishi kerak bo'lgan savollar). */
function isMedicalAdviceRequest(text) {
  const t = normalize(text);
  const patterns = [
    'qaysi dori', 'dori ich', 'qanday davola', 'nima ichsam', 'tashxis',
    'analiz natijasi nima', 'nima bo\'lgan menga', 'kasallikmi',
    'какое лекарство', 'что принимать', 'как лечить', 'диагноз',
    'что со мной', 'расшифруй анализ',
  ];
  return patterns.some((p) => t.includes(normalize(p)));
}

/** Operator so'ralganini aniqlash. */
function wantsOperator(text) {
  const t = normalize(text);
  const patterns = [
    'operator', 'odam bilan', 'tirik odam', 'registratura', 'administrator',
    'оператор', 'живой человек', 'с человеком', 'регистратура',
  ];
  return patterns.some((p) => t.includes(normalize(p)));
}

module.exports = {
  detectEmergency,
  routeToSpecialty,
  isMedicalAdviceRequest,
  wantsOperator,
  EMERGENCY_PATTERNS,
  EMERGENCY_COMBINATIONS,
  normalize,
};
