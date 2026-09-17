const triage = require('../src/services/triageService');

describe('shoshilinch holat triaji', () => {
  test('o\'zbekcha xavfli belgilar aniqlanadi', () => {
    const cases = [
      "otamning ko'kragi qattiq og'riyapti",
      'nafasi qisilyapti',
      'hushidan ketdi',
      'qon ketyapti, toxtatolmayapmiz',
      'bolam talvasa tutdi',
    ];
    for (const text of cases) {
      expect(triage.detectEmergency(text).isEmergency).toBe(true);
    }
  });

  test('ruscha xavfli belgilar aniqlanadi', () => {
    const cases = [
      'сильная боль в груди',
      'он задыхается',
      'потерял сознание',
      'сильное кровотечение',
    ];
    for (const text of cases) {
      expect(triage.detectEmergency(text).isEmergency).toBe(true);
    }
  });

  test('oddiy shikoyat shoshilinch deb belgilanmaydi', () => {
    const cases = [
      'terapevtga yozilmoqchiman',
      "boshim biroz og'riyapti",
      'хочу записаться к врачу',
      'узи qildirmoqchiman',
      // Yaqinlik qoidasi bo'lmasa, bular xato "shoshilinch" bo'lardi:
      "qon tahlili topshirib ketaman",
      "qon tahlili ko'p vaqt oladimi",
      "yurak tekshiruvidan o'tmoqchiman, keyin ketaman",
      'сдать кровь и уйти',
    ];
    for (const text of cases) {
      expect(triage.detectEmergency(text).isEmergency).toBe(false);
    }
  });

  test('bolada 39.5+ harorat shoshilinch hisoblanadi', () => {
    expect(triage.detectEmergency('bolamning harorati 40 daraja').isEmergency).toBe(true);
    // Kattada shunchaki harorat — shoshilinch emas
    expect(triage.detectEmergency('haroratim 38 daraja').isEmergency).toBe(false);
  });

  test('tibbiy maslahat so\'rovi aniqlanadi', () => {
    expect(triage.isMedicalAdviceRequest('menga qaysi dori yaxshi?')).toBe(true);
    expect(triage.isMedicalAdviceRequest('какое лекарство принимать?')).toBe(true);
    expect(triage.isMedicalAdviceRequest('ertaga bo\'sh joy bormi?')).toBe(false);
  });

  test('operator so\'rovi aniqlanadi', () => {
    expect(triage.wantsOperator('operator bilan gaplashmoqchiman')).toBe(true);
    expect(triage.wantsOperator('соедините с оператором')).toBe(true);
    expect(triage.wantsOperator('soat nechchida ochilasiz?')).toBe(false);
  });
});
