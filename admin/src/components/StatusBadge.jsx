const LABELS = {
  PENDING: ['Kutilmoqda', 'amber'],
  CONFIRMED: ['Tasdiqlangan', 'green'],
  CHECKED_IN: ['Kelgan', 'blue'],
  COMPLETED: ['Yakunlangan', ''],
  CANCELLED: ['Bekor qilingan', 'red'],
  NO_SHOW: ['Kelmadi', 'red'],
};

const SOURCES = {
  TELEGRAM: ['Telegram', 'blue'],
  VOICE: ['📞 Qo\'ng\'iroq', 'amber'],
  ADMIN: ['Registratura', ''],
};

const OUTCOMES = {
  BOOKED: ['Navbat olindi', 'green'],
  NOT_BOOKED: ['Olinmadi', ''],
  ESCALATED: ['Operatorga', 'amber'],
  DROPPED: ['Uzildi', ''],
  EMERGENCY: ['⚠️ SHOSHILINCH', 'red'],
  RESCHEDULED: ['Ko\'chirildi', 'blue'],
  CANCELLED: ['Bekor qilindi', 'red'],
  INFO_ONLY: ['Ma\'lumot', ''],
};

export function StatusBadge({ status }) {
  const [label, cls] = LABELS[status] || [status, ''];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function SourceBadge({ source }) {
  const [label, cls] = SOURCES[source] || [source, ''];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function OutcomeBadge({ outcome }) {
  const [label, cls] = OUTCOMES[outcome] || [outcome, ''];
  return <span className={`badge ${cls}`}>{label}</span>;
}
