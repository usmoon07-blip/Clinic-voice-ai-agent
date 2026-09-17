const availability = require('../src/services/availabilityService');

describe('bandlik yordamchi funksiyalari', () => {
  test('interval kesishuvi', () => {
    const d = (h) => new Date(`2026-09-18T${String(h).padStart(2, '0')}:00:00Z`);
    expect(availability.overlaps(d(9), d(10), d(9.5 | 0), d(11))).toBe(true);
    expect(availability.overlaps(d(9), d(10), d(10), d(11))).toBe(false); // yopishgan, kesishmaydi
    expect(availability.overlaps(d(9), d(10), d(7), d(8))).toBe(false);
  });

  test('yosh chegarasi', () => {
    expect(availability.ageFits(30, 18, 120)).toBe(true);
    expect(availability.ageFits(5, 18, 120)).toBe(false);
    expect(availability.ageFits(5, 0, 18)).toBe(true);
    expect(availability.ageFits(25, 0, 18)).toBe(false);
    // Yosh noma'lum bo'lsa cheklanmaydi
    expect(availability.ageFits(null, 18, 120)).toBe(true);
  });

  test('tanaffus ish oynasini ikkiga bo\'ladi', () => {
    const windows = availability.workWindowsForDay({
      workingHour: { isWorking: true, startTime: '09:00', endTime: '17:00', breakStart: '13:00', breakEnd: '14:00' },
      exception: null,
    });
    expect(windows).toEqual([{ start: 540, end: 780 }, { start: 840, end: 1020 }]);
  });

  test('tanaffussiz kun bitta oyna beradi', () => {
    const windows = availability.workWindowsForDay({
      workingHour: { isWorking: true, startTime: '09:00', endTime: '13:00' },
      exception: null,
    });
    expect(windows).toEqual([{ start: 540, end: 780 }]);
  });

  test('dam olish kunida oyna yo\'q', () => {
    expect(availability.workWindowsForDay({ workingHour: { isWorking: false, startTime: '09:00', endTime: '17:00' } })).toEqual([]);
    expect(availability.workWindowsForDay({ workingHour: null })).toEqual([]);
  });

  test('ta\'til/bayram istisnosi ish kunini bekor qiladi', () => {
    const workingHour = { isWorking: true, startTime: '09:00', endTime: '17:00' };
    for (const type of ['DAY_OFF', 'VACATION', 'HOLIDAY']) {
      expect(availability.workWindowsForDay({ workingHour, exception: { type } })).toEqual([]);
    }
  });

  test('qo\'shimcha ish kuni istisnosi o\'z vaqtini beradi', () => {
    const windows = availability.workWindowsForDay({
      workingHour: { isWorking: false, startTime: '09:00', endTime: '17:00' },
      exception: { type: 'EXTRA_WORKING_DAY', startTime: '10:00', endTime: '14:00' },
    });
    expect(windows).toEqual([{ start: 600, end: 840 }]);
  });
});
