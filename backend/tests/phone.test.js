const phone = require('../src/utils/phone');

describe('phone.normalize', () => {
  test('turli ko\'rinishdagi raqamlar bitta formatga keladi', () => {
    const expected = '+998901234567';
    expect(phone.normalize('901234567')).toBe(expected);
    expect(phone.normalize('90 123 45 67')).toBe(expected);
    expect(phone.normalize('+998901234567')).toBe(expected);
    expect(phone.normalize('998901234567')).toBe(expected);
    expect(phone.normalize('+998 (90) 123-45-67')).toBe(expected);
    expect(phone.normalize('8901234567')).toBe(expected);
  });

  test('bo\'sh yoki yaroqsiz qiymat null qaytaradi', () => {
    expect(phone.normalize('')).toBeNull();
    expect(phone.normalize(null)).toBeNull();
    expect(phone.normalize('123')).toBeNull();
  });

  test('maskalash: loglarda to\'liq raqam ko\'rinmaydi', () => {
    const masked = phone.mask('901234567');
    expect(masked).toContain('***');
    expect(masked).not.toContain('1234');
    expect(masked.endsWith('67')).toBe(true);
  });

  test('ovozda o\'qish uchun bo\'laklangan ko\'rinish', () => {
    expect(phone.speakable('+998901234567')).toBe('90 123 45 67');
  });
});
