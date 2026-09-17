const time = require('../src/utils/time');

describe('vaqt (Asia/Tashkent <-> UTC)', () => {
  test('Toshkent vaqti UTC ga to\'g\'ri o\'giriladi (+5)', () => {
    const utc = time.toUtc('2026-09-18', '09:30');
    expect(utc.toISOString()).toBe('2026-09-18T04:30:00.000Z');
  });

  test('UTC dan Toshkent kuni va vaqti qaytariladi', () => {
    const utc = new Date('2026-09-18T04:30:00.000Z');
    expect(time.dateKey(utc)).toBe('2026-09-18');
    expect(time.timeKey(utc)).toBe('09:30');
  });

  test('kun chegarasi: 23:30 Toshkent vaqti o\'sha kunga tegishli', () => {
    const utc = time.toUtc('2026-09-18', '23:30');
    expect(time.dateKey(utc)).toBe('2026-09-18');
    expect(utc.toISOString()).toBe('2026-09-18T18:30:00.000Z');
  });

  test('hafta kuni ISO bo\'yicha (1 = dushanba)', () => {
    expect(time.isoDayOfWeek('2026-09-21')).toBe(1); // dushanba
    expect(time.isoDayOfWeek('2026-09-20')).toBe(7); // yakshanba
  });

  test('daqiqa <-> HH:mm', () => {
    expect(time.hhmmToMinutes('09:30')).toBe(570);
    expect(time.minutesToHhmm(570)).toBe('09:30');
    expect(time.minutesToHhmm(0)).toBe('00:00');
  });

  test('og\'zaki sanani tushunish (uz va ru)', () => {
    const base = time.toTashkent(new Date('2026-09-17T06:00:00Z'));
    expect(time.parseSpokenDate('bugun', base)).toBe('2026-09-17');
    expect(time.parseSpokenDate('ertaga', base)).toBe('2026-09-18');
    expect(time.parseSpokenDate('завтра', base)).toBe('2026-09-18');
    expect(time.parseSpokenDate('indinga', base)).toBe('2026-09-19');
    expect(time.parseSpokenDate('2026-10-01', base)).toBe('2026-10-01');
  });

  test('og\'zaki vaqtni tushunish', () => {
    expect(time.parseSpokenTime('9:30')).toBe('09:30');
    expect(time.parseSpokenTime("to'qqiz yarim")).toBe('09:30');
    expect(time.parseSpokenTime('пол-одиннадцатого')).toBe('10:30');
    expect(time.parseSpokenTime('14')).toBe('14:00');
  });

  test('o\'zbekcha sana matni', () => {
    expect(time.formatDateHuman(new Date('2026-09-18T04:30:00Z'), 'UZ')).toContain('sentyabr');
  });
});
